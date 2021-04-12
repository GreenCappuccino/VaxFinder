import * as log4js from 'log4js';
import {Logger} from 'log4js';
import {LocationProperties} from './vaccineAggregator';
import {Feature, Point} from 'geojson';
import {Model} from 'sequelize/types';
import KDBush from 'kdbush';
import * as geokdbush from 'geokdbush';

export class Finder {

	static milesToKm = 1.609344;

	logger: Logger;
	index: KDBush<Feature<Point, LocationProperties>>;

	constructor() {
		this.logger = log4js.getLogger('finder');
		this.index = new KDBush([]);
		this.logger.info('Finder loaded.');
	}

	public async loadAvailableFeatures(locations: Feature<Point, LocationProperties>[]) {
		const start: number = Date.now();
		this.index = new KDBush(locations,
			(p) => p.geometry.coordinates[0],
			(p) => p.geometry.coordinates[1]);
		const indexingTime: number = (Date.now() - start);
		this.logger.debug(`Feature indexing took ${indexingTime} ms.`);
	}

	public processTracker(tracker: Model): Promise<Feature<Point, LocationProperties>[]> {
		return new Promise<Feature<Point, LocationProperties>[]>((resolve, reject) => {
			try {
				const found = geokdbush.around(this.index, tracker['longitude'], tracker['latitude'],
					5, tracker['radius'] * Finder.milesToKm,
					(item: Feature<Point, LocationProperties>) => {
						if (item.properties.appointments_available === null)
							return false;
						return item.properties.appointments_available;
					});
				resolve(found);
			} catch (e) {
				this.logger.error(e);
				reject('GeoKDBush failed');
			}
		});
	}

	public processTrackers(trackers: Model[]): Promise<FindResult[]> {
		return new Promise<FindResult[]>((resolve, reject) => {
			const start: number = Date.now();
			const processing = [];
			const results: FindResult[] = [];
			for (let i = 0; i < trackers.length; i++) {
				processing.push(this.processTracker(trackers[i]).then((found: Feature<Point, LocationProperties>[]) => {
					if (found.length > 0)
						results.push({
							model: trackers[i],
							features: found,
						});
				}).catch((e) => {
					this.logger.error(`Error while trying to perform around operation for tracker ${trackers[i]['msgsnowflake']}`);
					this.logger.error(e);
				}));
			}
			Promise.all(processing).then(() => {
				const findingTime: number = (Date.now() - start);
				this.logger.debug(`${results.length} trackers have been found to have appointments in their radius in ${findingTime} ms`);
				resolve(results);
			}).catch((e) => {
				this.logger.error(e);
				reject(e);
			});
		});
	}
}

export type FindResult = {
	model: Model,
	features: Feature<Point, LocationProperties>[]
};
