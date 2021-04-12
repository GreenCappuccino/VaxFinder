import {EmbedFieldData, Message, MessageEmbed} from 'discord.js';
import {Command, CommandoClient, CommandoMessage} from 'discord.js-commando';
import {Model} from 'sequelize/types';
import * as log4js from 'log4js';
import {Logger} from 'log4js';
import {Trackers} from '../models';
import {DiscordBot} from '../discord';

export class ListTrackersCommand extends Command {

	logger: Logger;

	constructor(client: CommandoClient) {
		super(client, {
			name: 'list-trackers',
			group: 'tracking',
			memberName: 'list-trackers',
			description: 'list your created trackers',
		});
		this.logger = log4js.getLogger('listTrackers');
		this.logger.info('List Trackers command loaded.');
	}

	public run(message: CommandoMessage): Promise<Message | Message[]> {
		return new Promise<Message>((resolve => {
			Trackers.findAll({
				where: {
					user: message.author.id,
				},
				attributes: ['msgsnowflake', 'address', 'radius', 'notes', 'triggered'],
			}).then((trackers: Model[]) => {
				const embedData: EmbedFieldData[] = [];
				for (let i = 0; i < trackers.length; i++) {
					embedData.push({
						name: `**index:** \`${i + 1}\` id: \`${trackers[i]['msgsnowflake']}\``,
						value: `**address:** ${trackers[i]['address']}
						**radius:** ${trackers[i]['radius']} mi
						**notes:** ${trackers[i]['notes']}
						**triggered:** ${trackers[i]['triggered']}`,
					});
				}
				if (trackers.length === 0) embedData.push({
					name: 'No trackers!',
					value: 'VaxFinder does not have any trackers under your account.',
				});
				const embed: MessageEmbed = DiscordBot.baseEmbed()
					.setTitle(`Trackers for ${message.author.username}`)
					.addFields(embedData);
				resolve(message.embed(embed));
			}).catch((e) => {
				this.logger.error(e);
				resolve(message.say('Something went wrong while trying to list trackers.'));
			});
		}));
	}
}
