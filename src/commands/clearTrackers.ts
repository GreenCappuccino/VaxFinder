import {Command, CommandoClient, CommandoMessage} from 'discord.js-commando';
import {Message} from 'discord.js';
import {Trackers, Users} from '../models';
import {Sequelize} from 'sequelize';
import {Logger} from 'log4js';
import * as log4js from 'log4js';
import {DiscordBot} from '../discord';

export class ClearTrackersCommand extends Command {

	logger: Logger;

	constructor(client: CommandoClient) {
		super(client, {
			name: 'clear-trackers',
			group: 'tracking',
			memberName: 'clear-trackers',
			description: 'delete all of the trackers under your user',
		});
		this.logger = log4js.getLogger('clearTrackers');
	}

	run(message: CommandoMessage): Promise<Message | Message[] | null> | null {
		return new Promise<Message | Message[] | null>(((resolve, reject) => {
			Trackers.destroy({where: {user: message.author.id}}).then(() => {
				Users.update({trackerCount: 0}, {
					where: {userid: message.author.id},
				}).then(() => {
					resolve(message.embed(DiscordBot.baseEmbed()
						.setTitle('Success')
						.addFields([{
							name: 'Status',
							value: `Deleted all trackers for ${message.author.username}`,
						}]),
					));
				}).catch((e) => {
					this.logger.error(e);
					resolve(message.embed(DiscordBot.baseEmbed()
						.setTitle('Failure')
						.addFields([{
							name: 'Status',
							value: `Failed to delete all trackers for ${message.author.username}`,
						}]),
					));
				});
			}).catch((e) => {
				this.logger.error(e);
				resolve(message.embed(DiscordBot.baseEmbed()
					.setTitle('Failure')
					.addFields([{
						name: 'Status',
						value: `Failed to delete all trackers for ${message.author.username}`,
					}]),
				));
			});
		}));
	}
}
