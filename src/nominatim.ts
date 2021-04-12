import * as log4js from 'log4js';
import {Logger} from 'log4js';
import assert from 'assert';
import {FeatureCollection, Point} from 'geojson';
import fetch from 'node-fetch';
import AbortController from 'abort-controller';
import urljoin from 'url-join';

export class Nominatim {

	private static server = 'https://nominatim.openstreetmap.org/';
	private static instance: Nominatim;

	cache;
	server: string;
	logger: Logger;

	private constructor(server: string) {
		this.logger = log4js.getLogger('nominatim');
		this.cache = {};
		this.server = server;
		this.logger.info('Nominatim loaded.');
	}

	public static getInstance(): Nominatim {
		if (Nominatim.instance !== null) {
			Nominatim.instance = new Nominatim(this.server);
		}
		return Nominatim.instance;
	}

	public search(query: string): Promise<Location> {
		const controller = new AbortController();
		setTimeout(
			() => {
				controller.abort();
			},
			5000,
		);
		return new Promise<Location>((resolve, reject) => {
			if (!this.cache[query]) {
				const url = urljoin(this.server, 'search?' + new URLSearchParams({
					q: query,
					format: 'geojson',
				}).toString());
				fetch(url, {
					method: 'GET',
					headers: {
						'X-Requested-With': 'XMLHttpRequest',
					},
					signal: controller.signal,
				}).then((response) => {
					if (!response.ok) {
						this.logger.error(response.statusText);
						reject(response.statusText);
					}
					response.json().then((data: FeatureCollection<Point>) => {
						assert(data.type === 'FeatureCollection',
							'GeoJSON response should be FeatureCollection.');
						assert(data.features.length > 0,
							'There must be at least one feature found.');
						// We're assuming that the first feature is the correct one.
						const location = new Location(
							data.features[0].geometry.coordinates[1],
							data.features[0].geometry.coordinates[0],
							data.features[0].properties.display_name,
						);
						this.cache[query] = location;
						resolve(location);
					}).catch((e) => {
						this.logger.error(e);
						reject(e);
					});
				}).catch((e) => {
					this.logger.error(e);
					reject(e);
				});
			} else resolve(this.cache[query]);
		});
	}

	public clearCache(): void {
		this.cache = {};
	}
}

export class Location {
	exists: boolean;
	latitude: number;
	longitude: number;
	display: string;

	constructor(latitude: number, longitude: number, display: string, exists = true) {
		this.exists = exists;
		this.latitude = latitude;
		this.longitude = longitude;
		this.display = display;
	}
}
