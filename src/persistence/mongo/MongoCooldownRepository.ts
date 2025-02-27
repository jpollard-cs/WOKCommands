import { CooldownEntity } from '../../domain/CooldownEntity';
import { ICooldownRepository, WhereOneInput } from '../ICooldownRepository';
import cooldownSchema from './models/cooldown';

export class MongoCooldownRepository implements ICooldownRepository {
  // todo: should we load all existing cooldowns at startup?
  async findOne(input: { commandId: string; guildId: string; userId?: string; }): Promise<CooldownEntity> {
    throw new Error('Method not implemented.');
  }
  async delete(input: { commandId: string; guildId: string; userId?: string; }): Promise<void> {
    const _id = MongoCooldownRepository.getIdFromWhereOneInput(input);
    await cooldownSchema.deleteOne({ _id, name: input.commandId })
  }
  async save(cooldown: CooldownEntity): Promise<CooldownEntity> {
    const { commandId, type, secondsRemaining } = cooldown
    const _id = MongoCooldownRepository.getIdFromEntity(cooldown);

    // TODO: should we start persisting date and other info
    await cooldownSchema.findOneAndUpdate(
      {
        _id,
        name: commandId,
        type,
      },
      {
        _id,
        name: commandId,
        type,
        cooldown: secondsRemaining,
      },
      { upsert: true }
    )

    return cooldown
  }

  private static getIdFromWhereOneInput({ commandId, guildId, userId }: WhereOneInput): string {
    const userIdSuffix = userId ? `-${userId}` : ''
    return `${commandId}-${guildId}${userIdSuffix}`
  }

  private static getIdFromEntity(cooldown: Partial<CooldownEntity>): string {
    const { guildId, userId, commandId, type } = cooldown
    let id;
    if (type === 'global') {
      id = `${commandId}-${guildId}`
    } else if(type === 'per-user') {
      id = `${commandId}-${guildId}-${userId}`
    } else {
      throw new Error('WOK Commands > unrecognized Cooldown type')
    }

    return id;
  }
}
