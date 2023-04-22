import { Album, Artists, MoosyncExtensionTemplate, Playlist, SearchReturnType, Song } from '@moosync/moosync-types'
import crypto from 'crypto'
import { XMLParser } from 'fast-xml-parser'
import { resolve } from 'path'
import { fetch } from './utils'

export class SubsonicExtension implements MoosyncExtensionTemplate {
  private _serverURL: string | undefined = 'https://music.picafe.me'
  #username: string | undefined = 'picafe'
  #password: string | undefined = 'ne7sO2JIV*%A!36W'

  private get serverURL() {
    if (this._serverURL) {
      return this._serverURL?.at(-1) === '/'
        ? this._serverURL.substring(0, this._serverURL.length - 1)
        : this._serverURL
    }
  }

  async onStarted() {
    await this.fetchInitialValues()
    this.registerListeners()
    this.setServerInfo()
  }

  private async fetchInitialValues() {
    this._serverURL = (await api.getPreferences('server_address')) ?? 'http://localhost:4533'
    this.#username = await api.getPreferences('username')
    this.#password = await api.getSecure('password')
  }

  private registerListeners() {
    api.on('requestedPlaylists', async () => {
      return {
        playlists: (await this.getAllPlaylists()) ?? []
      }
    })

    api.on('requestedPlaylistSongs', (playlistId, _, nextPageToken: NextPageToken) => {
      return this.getPlaylistSongs(playlistId, nextPageToken)
    })

    api.on('requestedSearchResult', async (term) => {
      return this.search(term)
    })

    api.on('requestedRecommendations', async () => {
      return {
        songs: (await this.getRecommendations()) ?? []
      }
    })

    api.on('requestedArtistSongs', async (artist) => {
      const artistId = artist?.artist_extra_info?.extensions?.[api.utils.packageName]?.['subsonic_artist_id']
      if (artistId) {
        return {
          songs: (await this.getArtistSongs(artistId)) ?? []
        }
      }
    })

    api.on('requestedAlbumSongs', async (album) => {
      const albumId = album?.album_extra_info?.extensions?.[api.utils.packageName]?.['subsonic_album_id']
      if (albumId) {
        return {
          songs: (await this.getAlbumSongs(albumId)) ?? []
        }
      }
    })

    api.on('preferenceChanged', async ({ key, value }) => {
      if (key === 'server_address') {
        this._serverURL = value.toString()
      } else if (key === 'username') {
        this.#username = value.toString()
      } else if (key === 'password') {
        this.#password = value.toString()
      }

      await this.setServerInfo()

    })
  }

  async setServerInfo() {
    try {
      const ping = await this.ping()

      await api.setPreferences('server_status', `
      Server URL: ${this.serverURL}
      Status: Connected
      Server Version: ${ping.serverVersion}
      Server Type: ${ping.type}`)
    } catch (e) {
      console.log(e)
      await api.setPreferences('server_status', `
      Server URL: ${this.serverURL}
      Status: Failed to connect
      Reason: ${e?.message}
      Code: ${e?.code}`)
    }
  }

  async ping() {
    return await this.populateRequest('ping', undefined, true, true)
  }

  generateParameters() {
    const salt = crypto.randomBytes(32).toString('hex')
    const computedToken = crypto
      .createHash('md5')
      .update(this.#password + salt)
      .digest('hex')

    return `u=${this.#username}&t=${computedToken}&s=${salt}&v=1.16.1&c=moosync`
  }

  formulateUrl<T extends SupportedMethods>(method: T, search: SearchParams<T>) {
    let parsedSearch = ''
    if (search) {
      for (const [key, value] of Object.entries(search)) {
        if (parsedSearch.length > 0) {
          parsedSearch += '&'
        }
        parsedSearch += `${key}=${value}`
      }
    }

    return `${this.serverURL}/rest/${method}?${this.generateParameters()}&${parsedSearch}`
  }

  private async populateRequest<T extends SupportedMethods>(
    method: T,
    search: SearchParams<T>,
    xml = true,
    throwOnError = false
  ): Promise<SubsonicResponse<T> | undefined> {
    if (!this.serverURL || !this.#username || !this.#password) {
      return undefined
    }

    try {
      const resp = await fetch(this.formulateUrl(method, search))
      if (xml) {
        const ret = new XMLParser({
          attributeNamePrefix: '',
          ignoreDeclaration: true,
          ignoreAttributes: false
        }).parse(resp)?.['subsonic-response']

        if ((ret as GenericResp)?.status !== 'ok') {
          if (throwOnError) {
            throw ret.error
          }
          console.error('Error in method', method, (ret as GenericResp)?.error)
          return undefined
        }
        return ret
      } else {
        return resp as unknown as SubsonicResponse<T>
      }
    } catch (e) {
      if (throwOnError) {
        throw e
      }
      console.error(e)
      return undefined
    }
  }

  async search(query: string, songCount = 20, songOffset = 0): Promise<SearchReturnType> {
    const resp = await this.populateRequest('search3', { query, songCount, songOffset })
    if (resp) {
      return {
        songs: this.parseSong(this.checkArray(resp.searchResult3.song)),
        playlists: this.parsePlaylist(this.checkArray(resp.searchResult3.playlist)),
        albums: this.parseAlbums(this.checkArray(resp.searchResult3.album)),
        artists: this.parseArtists(this.checkArray(resp.searchResult3.artist))
      }
    }
  }

  private parseAlbums(albumList: AlbumResp[]): Album[] {
    const ret: Album[] = []
    for (const a of albumList) {
      ret.push({
        album_name: a.album,
        album_id: a.id,
        album_coverPath_high: a.coverArt && this.formulateUrl('getCoverArt', { id: a.coverArt, size: 800 }),
        album_coverPath_low: a.coverArt && this.formulateUrl('getCoverArt', { id: a.coverArt, size: 80 }),
        album_extra_info: {
          extensions: {
            [api.utils.packageName]: {
              subsonic_album_id: a.id
            }
          }
        }
      })
    }

    return ret
  }

  private parseArtists(artistList: ArtistResp[]): Artists[] {
    const ret: Artists[] = []
    for (const a of artistList) {
      ret.push({
        artist_id: a.id,
        artist_name: a.name,
        artist_extra_info: {
          extensions: {
            [api.utils.packageName]: {
              subsonic_artist_id: a.id
            }
          }
        }
      })
    }

    return ret
  }

  private parseSong(songList: SongResp[], albumCover?: string) {
    const ret: Song[] = []

    for (const s of songList) {
      ret.push({
        _id: s.id,
        title: s.title,
        song_coverPath_high: this.formulateUrl('getCoverArt', { id: s.coverArt, size: 800 }),
        song_coverPath_low: this.formulateUrl('getCoverArt', { id: s.coverArt, size: 80 }),
        album: {
          album_name: s.album,
          album_id: s.albumId,
          album_coverPath_high: albumCover && this.formulateUrl('getCoverArt', { id: albumCover, size: 800 }),
          album_coverPath_low: albumCover && this.formulateUrl('getCoverArt', { id: albumCover, size: 80 }),
          album_extra_info: {
            extensions: {
              [api.utils.packageName]: {
                subsonic_album_id: s.albumId
              }
            }
          }
        },
        artists: [
          {
            artist_id: s.artistId,
            artist_name: s.artist,
            artist_extra_info: {
              extensions: {
                [api.utils.packageName]: {
                  subsonic_artist_id: s.artistId
                }
              }
            }
          }
        ],
        duration: parseInt(s.duration ?? '0'),
        playbackUrl: this.formulateUrl('stream', { id: s.id }),
        date_added: new Date(s.created).getTime(),
        type: 'URL'
      })
    }

    return ret
  }

  async getAllSongs(nextPageToken?: NextPageToken) {
    const resp = await this.search('""', 500, nextPageToken?.offset)
    return {
      songs: resp.songs, nextPageToken: {
        limit: 500,
        offset: (nextPageToken?.offset ?? 0) + 500
      }
    }
  }

  private parsePlaylist(playlists: PlaylistsResp['playlists']['playlist']) {
    const ret: Playlist[] = []
    for (const p of playlists) {
      ret.push({
        playlist_id: p.id,
        playlist_name: p.name
      })
    }

    return ret
  }

  async getPlaylistSongs(id: string, nextPageToken?: NextPageToken): Promise<{ songs: Song[], nextPageToken?: NextPageToken }> {
    if (id === 'subsonic_starred') {
      return { songs: await this.getStarred() }
    }

    if (id === 'all_songs') {
      return this.getAllSongs(nextPageToken)
    }

    const resp = await this.populateRequest('getPlaylist', {
      id
    })

    if (resp) {
      resp.playlist.entry = this.checkArray(resp.playlist.entry)
      return { songs: this.parseSong(resp.playlist.entry) }
    }
  }

  async getStarred() {
    const resp = await this.populateRequest('getStarred', undefined)
    if (resp) {
      resp.starred.song = this.checkArray(resp.starred.song)
      return this.parseSong(resp.starred.song)
    }
  }

  async getAllPlaylists() {
    const resp = await this.populateRequest('getPlaylists', undefined)
    if (resp) {

      const parsedPlaylists: Playlist[] = []
      if (typeof resp.playlists === 'object') {
        resp.playlists.playlist = this.checkArray(resp.playlists.playlist)
        parsedPlaylists.push(...this.parsePlaylist(resp.playlists.playlist))
      }

      const starredPlaylist: Playlist = {
        playlist_id: 'subsonic_starred',
        playlist_name: 'Starred',
        playlist_coverPath: resolve(__dirname, '../assets/starred_playlist.png')
      }


      const allSongs: Playlist = {
        playlist_id: 'all_songs',
        playlist_name: 'All Songs',
        playlist_coverPath: resolve(__dirname, '../assets/all_songs_playlist.png')
      }

      return [...parsedPlaylists, starredPlaylist, allSongs]
    }
  }

  async getRecommendations() {
    const resp = await this.populateRequest('getRandomSongs', { size: 50 })
    const similar: Song[] = []

    if (resp) {
      for (const s of this.checkArray(resp.randomSongs.song)) {
        const recom = await this.populateRequest('getSimilarSongs', {
          id: s.id
        })

        if (recom) {
          similar.push(...this.parseSong(this.checkArray(recom.similarSongs.song)))
        }

        if (similar.length >= 75) {
          break
        }
      }

      return similar
    }
  }

  async getAlbumSongs(id: string) {
    const resp = await this.populateRequest('getAlbum', { id })
    if (resp) {
      return this.parseSong(this.checkArray(resp.album.song))
    }
  }

  async getArtistSongs(id: string) {
    const ret: Song[] = []
    const artistResp = await this.populateRequest('getArtist', { id })
    if (artistResp) {
      const albums = this.checkArray(artistResp.artist.album).map((val) => val.id)
      for (const a of albums) {
        ret.push(...(await this.getAlbumSongs(a)))
      }
    }

    return ret
  }

  private checkArray<T>(elem?: T | T[]): T[] {
    if (elem) {
      if (!Array.isArray(elem)) {
        return [elem]
      } else {
        return elem
      }
    }
    return []
  }
}