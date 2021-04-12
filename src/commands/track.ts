import {Message} from 'discord.js';
import {Command, CommandoClient, CommandoMessage} from 'discord.js-commando';
import * as log4js from 'log4js';
import {Logger} from 'log4js';
import * as validUrl from 'valid-url';
import {Location, Nominatim} from './../nominatim';
import {Trackers, Users} from '../models';
import {Sequelize} from 'sequelize';
import {DiscordBot} from '../discord';

export class TrackCommand extends Command {

	geocoder: Nominatim;
	logger: Logger;

	constructor(client: CommandoClient) {
		super(client, {
			name: 'track',
			group: 'tracking',
			memberName: 'track',
			description: 'create a tracker for your account about an origin',
			args: [
				{
					key: 'address',
					prompt: 'Please enter your street address (and also ideally include a city name and state abbreviation) or a plus code.',
					type: 'string',
					validate: (text: string): Promise<boolean | string> => {
						return new Promise<boolean | string>((resolve) => {
							this.geocoder.search(text).then((location: Location) => {
								if (location.exists)
									resolve(true);
								else
									resolve('Could not find your address');
							}).catch((e) => {
								this.logger.error(e);
								resolve('Something went wrong while trying to find your address.');
							});
						});
					},
				},
				{
					key: 'radius',
					prompt: 'Please enter the search radius (in miles), that you want to find vaccine appointments in.',
					type: 'float',
					min: 0,
					max: 500,
				},
				{
					key: 'webhook',
					prompt: 'Enter an IFTTT-style webhook URL.',
					type: 'string',
					max: 2048,
					validate: (text: string): Promise<boolean | string> => {
						return new Promise<boolean | string>((resolve, reject) => {
							if (validUrl.isWebUri(text) != undefined)
								resolve(true);
							else
								resolve('Your URL is not valid.');
						});
					},
				},
				{
					key: 'notes',
					prompt: 'Enter any notes/descriptions related to the tracker.',
					type: 'string',
					max: 2048,
				},
			],
		});
		this.logger = log4js.getLogger('track');
		this.geocoder = Nominatim.getInstance();
		this.logger.info('Track command loaded.');
	}

	public run(message: CommandoMessage, {address, radius, webhook, notes}): Promise<Message | Message[]> {
		return new Promise<Message>((resolve) => {
			this.geocoder.search(address).then((location: Location) => {
				if (!location.exists) throw Error('No result from geocoding API for that address.');
				Trackers.create({
					msgsnowflake: message.id,
					user: message.author.id,
					address: location.display,
					longitude: location.longitude,
					latitude: location.latitude,
					radius: radius,
					notes: notes,
					alert: webhook,
					triggered: false,
				});
				Users.update({trackerCount: Sequelize.literal('trackerCount + 1')}, {
					where: {userid: message.author.id},
				});
				resolve(message.say(`Tracker for ${location.display} was created (Geocoded to lat: ${location.latitude} long: ${location.longitude}).`));
			}).catch((e) => {
				this.logger.error(e.name, e.message);
				//if (e.name === 'SequelizeUniqueConstraintError')
				//	resolve(message.say('You already have a tracker running. Edit it instead, or remove it first.'));
				if (e.message == 'No result from geocoding API for that address.')
					resolve(message.embed(DiscordBot.baseEmbed().setTitle('Error').addFields([{
						name: 'Reason',
						value: 'There was no match for your provided street address.',
					}])));
				else resolve(message.say('Something went wrong while adding your tracker.'));
			});
		});

	}
}
