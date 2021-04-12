import {FindResult} from './finder';
import AbortController from 'abort-controller';
import fetch from 'node-fetch';
import * as log4js from 'log4js';
import {Logger} from 'log4js';
import twilio from 'twilio';

export interface Notifier {
	notify(result: FindResult): Promise<string>;
}

export class TwilioNotifier implements Notifier {

	twilioClient;

	constructor() {
		this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
	}

	notify(result: FindResult): Promise<string> {
		return this.twilioClient.calls.create({
			from: '+13236132810',
			to: '+1'+result.model['alert'].replace('-', ''),
			url: process.env.TWIML_URL+'?'+new URLSearchParams({
				Message: `Your monitor for ${result.model['address']} with a radius of ${result.model['radius']} ` +
					'miles has been triggered! The nearest location covered is the ' +
					`${result.features[0].properties.provider} at ${result.features[0].properties.address}, ` +
					`${result.features[0].properties.city}, in state code ${result.features[0].properties.state}.` +
					`The postal code of this location is ${result.features[0].properties.postal_code}. Head over to vaccine spotter dot org for more details.`,
			}),
		});
	}
}

export class WebhookNotifier implements Notifier {

	logger: Logger;

	constructor() {
		this.logger = log4js.getLogger('webhookNotifier');
		this.logger.info('Webhook Notifier loaded.');
	}

	notify(result: FindResult): Promise<string> {
		return new Promise<string>(((resolve, reject) => {
			const controller = new AbortController();
			setTimeout(
				() => {
					controller.abort();
				},
				10000,
			);
			fetch(result.model['alert'], {
				method: 'POST',
				body: JSON.stringify({
					value1: `Your monitor for ${result.model['address']} with a radius of ${result.model['radius']} ` +
						'miles has been triggered! The nearest location covered is the ' +
						`${result.features[0].properties.provider} at ${result.features[0].properties.address}, ` +
						`${result.features[0].properties.city}, in state code ${result.features[0].properties.state}.` +
						`The postal code of this location is ${result.features[0].properties.postal_code}.`,
					value2: '',
					value3: '',
				}),
				headers: {
					'Content-Type': 'application/json',
				},
				signal: controller.signal,
			}).then((response) => {
				if (!response.ok) {
					this.logger.error(response.statusText);
					reject(response.statusText);
				}
				resolve(response.statusText);
			}).catch((e) => {
				this.logger.error(e);
				reject(e);
			});
		}));
	}
}
