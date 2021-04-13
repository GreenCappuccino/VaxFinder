import * as log4js from 'log4js';
import {Logger} from 'log4js';
import {Feature, FeatureCollection, GeoJsonProperties, Point} from 'geojson';
import fetch from 'node-fetch';
import AbortController from 'abort-controller';

export class VaccineAggregator {

	logger: Logger;
	abortTimeout = 12000;

	constructor() {
		this.logger = log4js.getLogger('vaccineAggregator');
		this.logger.info('Vaccine Aggregator loaded.');
	}

	public getAllLocations(): Promise<Feature<Point, LocationProperties>[]> {
		return new Promise<Feature<Point, LocationProperties>[]>((resolve, reject) => {
			this.getStates().then((states: State[]) => {
				const start: number = Date.now();
				this.logger.debug(`Aggregating features for ${states.length} states.`);
				let allFeatures: Feature<Point, LocationProperties>[] = [];
				const aggregating = [];
				for (let i = 0; i < states.length; i++) {
					aggregating.push(this.getLocations(states[i].code).then((features: Feature<Point, LocationProperties>[]) => {
						allFeatures = allFeatures.concat(features);
					}).catch((e) => {
						this.logger.error(`An error occurred while trying to grab features for state code ${states[i].code}.`);
						this.logger.error(e); // No rejection as the failure of any state can destroy everything.
					}));
				}
				Promise.all(aggregating).then(() => {
					const aggregationTime: number = (Date.now() - start) / 1000;
					this.logger.debug(`Aggregated ${allFeatures.length} features in ${aggregationTime} seconds.`);
					resolve(allFeatures);
				}).catch((e) => {
					this.logger.error(e);
					reject(e);
				});
			}).catch((e) => {
				this.logger.error('An error occurred while trying to grab states.');
				this.logger.error(e);
				reject(e);
			});
		});
	}

	public getLocations(stateCode: string): Promise<Feature<Point, LocationProperties>[]> {
		return new Promise<Feature<Point, LocationProperties>[]>((resolve, reject) => {
			const controller = new AbortController();
			setTimeout(
				() => {
					controller.abort();
				},
				this.abortTimeout,
			);
			fetch(`https://www.vaccinespotter.org/api/v0/states/${stateCode}.json`, {
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
				response.json().then((data: FeatureCollection<Point, LocationProperties>) => {
					if (data.features === null)
						data.features = [];
					this.logger.trace(`Received ${data.features.length} features for code ${stateCode}.`);
					resolve(data.features);
				}).catch((e) => {
					this.logger.error(e);
					reject(e);
				});
			}).catch((e) => {
				this.logger.error(e);
				reject(e);
			});
		});
	}

	public getStates(): Promise<State[]> {
		return new Promise<State[]>((resolve, reject) => {
			const controller = new AbortController();
			setTimeout(
				() => {
					controller.abort();
				},
				this.abortTimeout,
			);
			fetch('https://www.vaccinespotter.org/api/v0/states.json', {
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
				response.json().then((data: StateResponse[]) => {
					const states: State[] = [];
					for (let i = 0; i < data.length; i++)
						states.push(this.convertStateResponse(data[i]));
					this.logger.trace(`Received metadata for ${states.length} states.`);
					resolve(states);
				}).catch((e) => {
					this.logger.error(e);
					reject(e);
				});
			}).catch((e) => {
				this.logger.error(e);
				reject(e);
			});
		});
	}

	private convertStateResponse(response: StateResponse): State {

		return {
			code: response.code,
			name: response.name,
			store_count: response.store_count !== null ? parseInt(response.store_count) : null,
			provider_brand_count: response.provider_brand_count !== null ? parseInt(response.provider_brand_count) : null,
			appointments_last_fetched: response.appointments_last_fetched !== null ? new Date(response.appointments_last_fetched) : null,
			appointments_last_modified: response.appointments_last_modified !== null ? new Date(response.appointments_last_modified) : null,
			provider_brands: response.provider_brands !== null ? response.provider_brands.map(pr => this.convertProviderBrandResponse(pr)) : null,
		};
	}

	private convertProviderBrandResponse(response: ProviderBrandResponse): ProviderBrand {
		return {
			id: response.id,
			key: response.key,
			url: response.url,
			name: response.name,
			status: response.status,
			provider_id: response.provider_id,
			location_count: response.location_count,
			appointments_last_fetched: new Date(response.appointments_last_fetched),
			appointments_last_modified: new Date(response.appointments_last_modified),
		};
	}
}

export interface LocationProperties extends GeoJsonProperties {
	id: number,
	url: string,
	city: string,
	name: string,
	state: string,
	address: string,
	provider: string,
	time_zone: string,
	postal_code: string,
	appointments,
	provider_brand: string,
	carries_vaccine,
	appointment_types,
	provider_brand_id: number,
	provider_brand_name: string,
	provider_location_id: string,
	appointments_available: boolean | null,
	appointment_vaccine_types,
	appointments_last_fetched: string,
	appointments_last_modified: string,
	appointments_available_all_doses,
	appointments_available_2nd_dose_only,
}

export interface State {
	code: string,
	name: string,
	store_count: number,
	provider_brand_count: number,
	appointments_last_fetched: Date,
	appointments_last_modified: Date,
	provider_brands: ProviderBrand[],
}

export interface ProviderBrand {
	id: number,
	key: string,
	url: string,
	name: string,
	status: string,
	provider_id: string,
	location_count: number,
	appointments_last_fetched: Date,
	appointments_last_modified: Date
}

interface StateResponse {
	code: string,
	name: string,
	store_count: string,				// Convert to number
	provider_brand_count: string,		// Convert to number
	appointments_last_fetched: string,	// Convert to Date
	appointments_last_modified: string,	// Convert to Date
	provider_brands: ProviderBrandResponse[],
}

interface ProviderBrandResponse {
	id: number,
	key: string,
	url: string,
	name: string,
	status: string,
	provider_id: string,
	location_count: number,
	appointments_last_fetched: string,	// Convert to Date
	appointments_last_modified: string,	// Convert to Date
}

