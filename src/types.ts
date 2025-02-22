import {
  ApplicationCommandOptionData,
  Client,
  CommandInteraction,
  Guild,
  GuildMember,
  Message,
  PermissionString,
  TextChannel,
  User,
} from 'discord.js'

import { ConnectionOptions } from 'mongoose'
// import { EventEmitter } from 'events'
import WOKCommands from '.'
import { DbConnectionStatus } from './enums/DbConnectionStatus'
import { ICooldownRepository } from './persistence/ICooldownRepository'
import { IGuildSettingsRepository } from './persistence/IGuildSettingsRepository'

// todo: do we need to maintain types here?
// export default class WOKCommands extends EventEmitter {
//   private _client: Client
//   private _defaultPrefix: string
//   private _commandsDir: string
//   private _featuresDir: string
//   private _displayName: string
//   private _guildSettings: Collection<string, GuildSettingsAggregate>
//   private _categories: Map<String, String | GuildEmoji>
//   private _hiddenCategories: string[]
//   private _color: string
//   private _commandHandler: CommandHandler
//   private _featureHandler: FeatureHandler | null
//   private _tagPeople: boolean
//   private _showWarns: boolean
//   private _delErrMsgCooldown: number
//   private _ignoreBots: boolean
//   private _botOwner: string[]
//   private _testServers: string[]
//   private _defaultLanguage: string
//   private _messageHandler: MessageHandler
//   private _slashCommand: SlashCommands
//   private _guildSettingsRepository: IGuildSettingsRepository
//   private _cooldownRepository: ICooldownRepository;

//   constructor(client: Client, options?: Options)

//   public get mongoPath(): string
//   public setMongoPath(mongoPath: string | undefined): WOKCommands
//   public get client(): Client
//   public get displayName(): string
//   public setDisplayName(displayName: string): WOKCommands
//   public get prefixes(): { [name: string]: string }
//   public get defaultPrefix(): string
//   public setDefaultPrefix(defaultPrefix: string): WOKCommands
//   public getPrefix(guild: Guild | null): string
//   public setPrefix(guild: Guild | null, prefix: string): WOKCommands
//   public get categories(): Map<String, String | GuildEmoji>
//   public get hiddenCategories(): string[]
//   public get color(): string
//   public setColor(color: string): WOKCommands
//   public getEmoji(category: string): string
//   public getCategory(emoji: string): string
//   public setCategorySettings(
//     category: string | Array<Record<string, any>>,
//     emoji?: string
//   ): WOKCommands
//   public isEmojiUsed(emoji: string): boolean
//   public get commandHandler(): CommandHandler
//   public get mongoConnection(): Connection | null
//   public isDBConnected(): boolean
//   public setTagPeople(tagPeople: boolean): WOKCommands
//   public get tagPeople(): boolean
//   public get showWarns(): boolean
//   public get delErrMsgCooldown(): number
//   public get ignoreBots(): boolean
//   public get botOwner(): string[]
//   public setBotOwner(botOwner: string | string[]): WOKCommands
//   public get testServers(): string[]
//   public get defaultLanguage(): string
//   public setDefaultLanguage(defaultLanguage: string): WOKCommands
//   public get messageHandler(): MessageHandler
//   public get slashCommands(): SlashCommands
// }

export interface OptionsWithS {
  commandDir?: never
  featureDir?: never

  commandsDir: string
  featuresDir?: string
  messagesPath?: string
  showWarns?: boolean
  delErrMsgCooldown?: number
  defaultLanguage?: string
  ignoreBots?: boolean
  testServers?: string | string[]
  botOwners?: string | string[]
  disabledDefaultCommands?: string | string[]
  typeScript?: boolean
  ephemeral?: boolean
  debug?: boolean
}

export type DbConnectionStrategy = 'MONGOOSE' | 'GENERIC'
export type MongooseDBOptions = {
  dbConnectionStrategy: 'MONGOOSE'
  mongoUri?: string
  dbOptions?: ConnectionOptions
}

export type GenericDBOptions = {
  dbConnectionStrategy: 'GENERIC'
  isDbConnected: () => boolean
  getDbConnectionStatus: () => DbConnectionStatus
  guildSettingsRepository: IGuildSettingsRepository
  cooldownRepository: ICooldownRepository
}

export type DbOptions =  MongooseDBOptions | GenericDBOptions

export interface OptionsWithoutS {
  commandsDir?: never
  featuresDir?: never
  commandDir: string
  featureDir?: string
  messagesPath?: string
  showWarns?: boolean
  delErrMsgCooldown?: number
  defaultLanguage?: string
  ignoreBots?: boolean
  testServers?: string | string[]
  botOwners?: string | string[]
  disabledDefaultCommands?: string | string[]
  typeScript?: boolean
  ephemeral?: boolean
  debug?: boolean
}

export type Options = (OptionsWithS | OptionsWithoutS) & DbOptions

export interface ICallbackObject {
  channel: TextChannel
  message: Message
  args: string[]
  text: string
  client: Client
  prefix: string
  instance: WOKCommands
  interaction: CommandInteraction
  options: ApplicationCommandOptionData[]
  user: User
  member: GuildMember
  guild: Guild | null
  cancelCoolDown(): any
}

export interface IErrorObject {
  error: CommandErrors
  command: string
  message: Message
  info: object
}

export type optionTypes =
  | 'SUB_COMMAND'
  | 'SUB_COMMAND_GROUP'
  | 'STRING'
  | 'INTEGER'
  | 'BOOLEAN'
  | 'USER'
  | 'CHANNEL'
  | 'ROLE'
  | 'MENTIONABLE'
  | 'NUMBER'

export interface ICommand {
  names?: string[] | string
  aliases?: string[] | string
  category: string
  description: string
  callback?(obj: ICallbackObject): any
  error?(obj: IErrorObject): any
  minArgs?: number
  maxArgs?: number
  syntaxError?: { [key: string]: string }
  expectedArgs?: string
  expectedArgsTypes?: optionTypes[]
  syntax?: string
  requiredPermissions?: PermissionString[]
  permissions?: PermissionString[]
  cooldown?: string
  globalCooldown?: string
  ownerOnly?: boolean
  hidden?: boolean
  guildOnly?: boolean
  testOnly?: boolean
  slash?: boolean | 'both'
  options?: ApplicationCommandOptionData[]
  requireRoles?: boolean
}

export interface ISlashCommand {
  id: string
  application_id: string
  name: string
  description: string
  version: string
  default_permission: boolean
}

export interface ICategorySetting {
  name: string
  emoji: string
  hidden?: boolean
  customEmoji?: boolean
}

export enum CommandErrors {
  EXCEPTION = 'EXCEPTION',
  COOLDOWN = 'COOLDOWN',
  INVALID_ARGUMENTS = 'INVALID ARGUMENTS',
  MISSING_PERMISSIONS = 'MISSING PERMISSIONS',
  MISSING_ROLES = 'MISSING ROLES',
  COMMAND_DISABLED = 'COMMAND DISABLED',
}

export enum Events {
  DATABASE_CONNECTED = 'databaseConnected',
  LANGUAGE_NOT_SUPPORTED = 'languageNotSupported',
  COMMAND_EXCEPTION = 'commandException',
}
