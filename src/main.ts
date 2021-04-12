import 'reflect-metadata';
import * as log4js from 'log4js';
import {Logger} from 'log4js';
import {LocationProperties, VaccineAggregator} from './vaccineAggregator';
import {Feature, Point} from 'geojson';
import {DiscordBot} from './discord';
import * as logging from './logging';
import {Finder, FindResult} from './finder';
import * as models from './models';
import {Trackers} from './models';
import {Model} from 'sequelize/types';
import {TwilioNotifier, WebhookNotifier} from './notifiers';
import {Nominatim} from './nominatim';
import {Webserver} from './website';

const startDate: Date = new Date();

logging.setupLogging();
models.syncModels();

const aggregator: VaccineAggregator = new VaccineAggregator();
const finder: Finder = new Finder();
const discord: DiscordBot = new DiscordBot();
const webserver: Webserver = new Webserver(parseInt(process.env.VAXFINDER_WEBSERVER_PORT));
const webhookNotifier: WebhookNotifier = new WebhookNotifier();
const twilioNotifier: TwilioNotifier = new TwilioNotifier();

webserver.start();

let working = false;
const updateLogger: Logger = log4js.getLogger('update');
const update = async () => {
	if (!working) {
		working = true;
		updateLogger.debug('Started new update sequence.');
		aggregator.getAllLocations().then((features: Feature<Point, LocationProperties>[]) => {
			discord.commando.user.setActivity(`^help | Tracking ${features.length} locations`);
			finder.loadAvailableFeatures(features);
			Trackers.findAll({
				where: {
					triggered: false,
				},
				attributes: ['msgsnowflake', 'user', 'address', 'longitude', 'latitude', 'radius', 'notes', 'alert', 'triggered'],
			}).then((trackers: Model[]) => {
				finder.processTrackers(trackers).then((results: FindResult[]) => {
					for (let i = 0; i < results.length; i++) {
						twilioNotifier.notify(results[i]).catch(e => updateLogger.error(e));
						Trackers.update({triggered: true}, {
							where: {msgsnowflake: results[i].model['msgsnowflake']},
						}).then(([affected, rows]) => {
							if (affected === 0)
								updateLogger.warn('No row found to trigger tracker.');
						}).catch(e => updateLogger.error(e));
					}
				}).catch(e => updateLogger.error(e));
			}).catch(
				e => updateLogger.error(e),
			).finally(() => {
				working = false;
			});
		}).catch((e) => {
			updateLogger.error('Failed to successfully aggregate vaccine data.');
			updateLogger.error(e);
		}).finally(() => {
			working = false;
		});
	} else {
		updateLogger.warn('Looks like the previous update cycle did not end yet. Not starting another one.');
	}
};

update();
setInterval(() => {
	update();
}, 15000); // 1 min

setInterval(() => {
	Nominatim.getInstance().clearCache();
	updateLogger.debug('Cleared Nominatim cache.');
}, 86400000); // 24 hours

