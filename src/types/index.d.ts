interface FetchConfig {
  method: 'GET' | 'POST'
  headers: Record<string, string | number>
}

type SupportedMethods =
  | 'search3'
  | 'getMusicFolders'
  | 'getMusicDirectory'
  | 'getIndexes'
  | 'getArtist'
  | 'getAlbum'
  | 'getCoverArt'
  | 'getPlaylists'
  | 'getPlaylist'
  | 'getStarred'
  | 'stream'
  | 'getRandomSongs'
  | 'getSimilarSongs'

interface GenericResp {
  xmlns: string
  status: string
  version: string
  type: string
  serverVersion: string
  error?: {
    code: string
    message: string
  }
}

interface MusicFolder {
  musicFolder: {
    id: string
    name: string
  }
  lastModified: string
  ignoredArticles: 'string'
}

interface ArtistResp {
  id: string
  name: string // Actual name of artist
  albumCount: string
}

interface IndexesResp extends GenericResp {
  indexes: {
    index?: {
      artist: ArtistResp[]
      name?: string // Alphabet
    }[]
  }
}

interface AlbumResp {
  id: string
  parent: string
  isDir: boolean
  title: string
  name: string
  album: string
  artist: string
  coverArt: string
  duration: string
  created: string
  artistId: string
  songCount: string
  isVideo: boolean
}

interface ArtistDetailResp extends GenericResp {
  artist: {
    album?: AlbumResp[]
    id: string
    name: string // Actual name of artist
    albumCount: string
  }
}

interface SongResp {
  id: string
  parent: string
  isDir: boolean
  title: string
  album: string
  artist: string
  coverArt: string
  duration: string
  size: string
  contentType: string
  suffix: string
  path: string
  created: string
  albumId: string
  artistId: string
  type: string
  isVideo: boolean
}
interface AlbumsResp extends GenericResp {
  album: AlbumResp & {
    song?: SongResp[]
  }
}

interface PlaylistResp {
  id: string
  name: string
  songCount: string
  duration: string
  public: string
  owner: string
  created: string
  changed: string
}

interface PlaylistsResp extends GenericResp {
  playlists: {
    playlist?: PlaylistResp[]
  }
}

interface PlaylistDetailsResp extends GenericResp {
  playlist: PlaylistResp & {
    entry?: SongResp[]
  }
}

interface StarredResp extends GenericResp {
  starred: {
    song?: SongResp[]
  }
}

interface SearchResp extends GenericResp {
  searchResult3: {
    song?: SongResp[]
    artist?: ArtistResp[]
    album?: AlbumResp[]
    playlist?: PlaylistResp[]
  }
}

interface RandomSongResp extends GenericResp {
  randomSongs: {
    song: SongResp[]
  }
}

interface SimilarSongResp extends GenericResp {
  similarSongs: {
    song: SongResp[]
  }
}

interface MusicFoldersResp extends GenericResp {
  musicFolders: MusicFolder[] | MusicFolder
}

type SubsonicResponse<T extends SupportedMethods> = T extends 'getMusicFolders'
  ? MusicFoldersResp
  : T extends 'getIndexes'
  ? IndexesResp
  : T extends 'getArtist'
  ? ArtistDetailResp
  : T extends 'getAlbum'
  ? AlbumsResp
  : T extends 'getPlaylists'
  ? PlaylistsResp
  : T extends 'getPlaylist'
  ? PlaylistDetailsResp
  : T extends 'getStarred'
  ? StarredResp
  : T extends 'search3'
  ? SearchResp
  : T extends 'getRandomSongs'
  ? RandomSongResp
  : T extends 'getSimilarSongs'
  ? SimilarSongResp
  : undefined

type SearchParams<T extends SupportedMethods> = T extends 'search3'
  ? {
      query: string
      artistCount?: number
      artistOffset?: number
      albumCount?: number
      albumOffset?: number
      songCount?: number
      songOffset?: number
      musicFolderId?: string
    }
  : T extends 'getMusicDirectory' | 'getArtist' | 'getAlbum' | 'getPlaylist' | 'stream' | 'getSimilarSongs'
  ? {
      id: string
    }
  : T extends 'getCoverArt'
  ? {
      id: string
      size?: number
    }
  : T extends 'getRandomSongs'
  ? {
      size?: number
    }
  : undefined

interface LoginResponse {
  'subsonic-response': {}
}
