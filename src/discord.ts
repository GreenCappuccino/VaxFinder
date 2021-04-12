import {CommandoClient, SQLiteProvider} from 'discord.js-commando';
import {TrackCommand} from './commands/track';
import {ListTrackersCommand} from './commands/listTrackers';
import * as sqlite from 'sqlite';
import {Database} from 'sqlite';
import path from 'path';
import sqlite3 from 'sqlite3';
import * as log4js from 'log4js';
import {Logger} from 'log4js';
import {MessageEmbed} from 'discord.js';
import {ClearTrackersCommand} from './commands/clearTrackers';
import {Users} from './models';
import {Model} from 'sequelize/types';

export class DiscordBot {

	commando: CommandoClient;
	logger: Logger;

	constructor() {
		this.logger = log4js.getLogger('discord');
		this.commando = new CommandoClient({
			commandPrefix: '^',
			owner: process.env.VAXFINDER_DISCORD_OWNER,
		});
		/*
		this.commando.dispatcher.intercept = (message, oldMessage) => {
			return new Promise<[ExtendedMessage, ExtendedMessage]>(((resolve, reject) => {
				if (message.command !== undefined && message.author !== undefined) {
					Users.findOne({where: {userid: message.author.id}}).then((user: Model | null) => {
						if (user === null) // User doesn't exist in entries
							Users.create({
								userid: message.author.id,
								username: message.author.username,
								trackerCount: 0,
							}).then(() => {
								resolve([message, oldMessage]);
							}).catch((e) => {
								this.logger.error(e);
								reject(e);
							});
						else
							resolve([message, oldMessage]);
					}).catch((e) => {
						this.logger.error(e);
						reject(e);
					});
				} else {
					resolve([message, oldMessage]);
				}
			}));
		};
		 */
		this.commando.registry
			.registerDefaultTypes()
			.registerGroups([
				['tracking', 'Tracking'],
			])
			.registerDefaultGroups()
			.registerDefaultCommands()
			.registerCommand(new TrackCommand(this.commando))
			.registerCommand(new ListTrackersCommand(this.commando))
			.registerCommand(new ClearTrackersCommand(this.commando));
		this.commando.setProvider(
			sqlite.open({
				filename: path.join(__dirname, 'db', 'commando.sqlite'),
				driver: sqlite3.Database,
			}).then((db: Database) => {
				return new SQLiteProvider(db);
			}),
		).catch((e) => {
			this.logger.error(e);
		});
		this.commando.once('ready', () => {
			this.logger.info('Discord Bot ready!');
			this.commando.user.setActivity('^help | Just restarted!');
		});
		this.commando.login(process.env.VAXFINDER_DISCORD_TOKEN);
		this.logger.info('Discord Bot loaded.');
	}

	public static baseEmbed(): MessageEmbed {
		return new MessageEmbed()
			.setColor('RED')
			.setFooter('VaxFinder by Brian Lu | Data Courtesy of vaccinespotter.org and OpenStreetMap.');
	}
}
