import fs from 'fs';
import path from 'path';
import * as log4js from 'log4js';
import {Logger} from 'log4js';

export const setupLogging = () => {
	if (!fs.existsSync(path.join(__dirname, 'logs'))) fs.mkdirSync(path.join(__dirname, 'logs'));

	const logDir: string = path.join(__dirname, 'logs');
	//const logPath: string = path.join(logDir, startDate.toUTCString().replace(/:/g, '-').concat('.log'));
	const logPath: string = path.join(logDir, 'mainlog.log');
	fs.openSync(logPath, 'w');

	log4js.configure({
		appenders: {
			out: {
				type: 'stdout',
			},
			mainlog: {
				type: 'file',
				filename: logPath,
			},
		},
		categories: {
			default: {appenders: ['out', 'mainlog'], level: 'trace'},
			discord: {appenders: ['out', 'mainlog'], level: 'trace'},
			website: {appenders: ['out', 'mainlog'], level: 'debug'},
			update: {appenders: ['out', 'mainlog'], level: 'debug'},
			axios: {appenders: ['out', 'mainlog'], level: 'info'}, // debug is flooded with request/response
			nominatim: {appenders: ['out', 'mainlog'], level: 'trace'},
			vaccineAggregator: {appenders: ['out', 'mainlog'], level: 'debug'},
			webhookNotifier: {appenders: ['out', 'mainlog'], level: 'trace'},
			finder: {appenders: ['out', 'mainlog'], level: 'trace'},
			track: {appenders: ['out', 'mainlog'], level: 'trace'},
			listTrackers: {appenders: ['out', 'mainlog'], level: 'trace'},
			clearTrackers: {appenders: ['out', 'mainlog'], level: 'trace'},
		},
	});
	const logger: Logger = log4js.getLogger();
	logger.info('Logger ready.');
};
