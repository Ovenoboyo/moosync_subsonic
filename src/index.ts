import {
  ExtensionData,
  ExtensionFactory,
  ExtensionPreferenceGroup,
  MoosyncExtensionTemplate
} from '@moosync/moosync-types'
import { SubsonicExtension } from './extension'

export default class MyExtensionData implements ExtensionData {
  extensionDescriptors: ExtensionFactory[] = [new MyExtensionFactory()]
}

class MyExtensionFactory implements ExtensionFactory {
  async registerUserPreferences(): Promise<ExtensionPreferenceGroup[]> {
    return [
      {
        type: 'EditText',
        default: 'http://localhost:4533',
        title: 'Server address',
        description: 'IP / Domain address of your Subsonic compatible server',
        key: 'server_address'
      },
      {
        type: 'EditText',
        default: '',
        title: 'Username',
        description: 'Username for your subsonic compatible server',
        inputType: 'text',
        key: 'username'
      },
      {
        type: 'EditText',
        default: '',
        title: '',
        description: 'Password for your subsonic compatible server',
        inputType: 'password',
        key: 'password'
      }
    ]
  }

  async create(): Promise<MoosyncExtensionTemplate> {
    return new SubsonicExtension()
  }
}
