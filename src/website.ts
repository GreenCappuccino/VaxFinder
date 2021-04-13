import express, {Express} from 'express';
import exphbs from 'express-handlebars';
import * as log4js from 'log4js';
import {Logger} from 'log4js';
import path from 'path';
import passport from 'passport';
import {Strategy as DiscordStrategy, Scope as DiscordScope} from '@oauth-everything/passport-discord';
import cors from 'cors';
import session from 'express-session';
import {ensureLoggedIn} from 'connect-ensure-login';
import {Trackers} from './models';
import {Nominatim} from './nominatim';
import {Model} from 'sequelize/types';
import {Strategy as GoogleStrategy} from 'passport-google-oauth2';

interface User {
	user_id: string,
	username: string,
	display: string,
	avatar: string,
	provider: string,
}

export class Webserver {

	port: number;
	logger: Logger;
	web: Express;
	users: Map<string, User>;
	geocoder: Nominatim;

	constructor(port: number) {
		this.port = port;
		this.users = new Map<string, User>();
		this.logger = log4js.getLogger('website');
		this.web = express();
		this.geocoder = Nominatim.getInstance();

		this.web.use(express.static(path.join(__dirname, 'static')));

		this.web.use(cors());
		this.web.use(express.urlencoded({
			extended: true,
		}));
		this.web.use(session({
			secret: process.env.VAXFINDER_SESSION_SECRET,
			resave: false,
			saveUninitialized: false,
		}));
		this.web.use(passport.initialize());
		this.web.use(passport.session());

		passport.serializeUser(((user: User, done) => {
			done(null, user.user_id);
		}));

		passport.deserializeUser(((id: string, done) => {
			done(null, this.users.get(id));
		}));

		passport.use(new GoogleStrategy({
			clientID: process.env.VAXFINDER_GOOGLE_CLIENT_ID,
			clientSecret: process.env.VAXFINDER_GOOGLE_CLIENT_SECRET,
			callbackURL: `${process.env.VAXFINDER_HOST}/login/google/callback`,
			passReqToCallback: false},
		(accessToken, refreshToken, profile, cb) => {
			this.logger.trace(profile);
			this.users.set(profile.id, {
				avatar: profile.photos.filter(photo => photo.type === 'default')[0]?.value,
				display: profile.given_name,
				user_id: profile.id,
				username: profile.id,
				provider: 'Google',
			});
			return cb(null, this.users.get(profile.id));
		},
		));
		passport.use(new DiscordStrategy({
			clientID: process.env.VAXFINDER_DISCORD_OAUTH_CLIENT_ID,
			clientSecret: process.env.VAXFINDER_DISCORD_OAUTH_CLIENT_SECRET,
			callbackURL: `${process.env.VAXFINDER_HOST}/login/discord/callback`,
			scope: [DiscordScope.IDENTIFY],
		}, (accessToken, refreshToken, profile, cb) => {
			this.logger.trace(profile);
			this.users.set(profile.id, {
				avatar: profile.photos.filter(photo => photo.primary === true)[0]?.value,
				display: profile.displayName,
				user_id: profile.id,
				username: profile.username,
				provider: 'Discord',
			});
			cb(null, this.users.get(profile.id));
		}));
		this.web.engine('handlebars', exphbs());
		this.web.set('views', path.join(__dirname, 'views'));
		this.web.set('view engine', 'handlebars');

		this.web.get('/', ((req, res) => {
			res.render('home', {
				data: Webserver.addUserData(req),
			});
		}));

		this.web.get('/login', (req, res) => {
			res.render('login', {
				data: Webserver.addUserData(req),
			});
		});
		this.web.get('/privacy-policy', (req, res) => {
			res.render('privacy-policy', {
				data: Webserver.addUserData(req),
			});
		});
		this.web.get('/terms-of-service', (req, res) => {
			res.render('tos', {
				data: Webserver.addUserData(req),
			});
		});
		this.web.get('/login/google', passport.authenticate('google', { scope: ['profile'] }));

		this.web.get('/login/google/callback',
			passport.authenticate('google', { failureRedirect: '/login' }),
			function(req, res) {
				res.redirect('/');
			},
		);

		this.web.get('/login/discord', passport.authenticate('discord'));

		this.web.get('/login/discord/callback', passport.authenticate('discord', {
			session: true,
			successReturnToOrRedirect: '/',
		}));

		this.web.get('/logout', function (req, res) {
			req.session.destroy(() => res.redirect('/'));
		});
		this.web.get('/track', ensureLoggedIn('/login'), (req, res) => {
			res.render('track', {
				data: Webserver.addUserData(req),
			});
		});
		this.web.post('/submitTracker', ensureLoggedIn('/login'), ((req, res) => {
			const address = req.body.address;
			const radius = req.body.radius;
			const phone = req.body.phone;
			const notes = req.body.notes;
			this.geocoder.search(address).then((location) => {
				if (!location.exists) throw Error('No result from geocoding API for that address.');
				Trackers.create({
					msgsnowflake: Date.now().toString(),
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore
					user: req.user.user_id,
					address: location.display,
					longitude: location.longitude,
					latitude: location.latitude,
					radius: radius,
					notes: notes,
					alert: phone,
					triggered: false,
				});
			}).catch((e) => {
				this.logger.error(e);
			}).finally(() => {
				res.redirect('myAccount');
			});
		}));
		this.web.get('/clearTrackers', ensureLoggedIn('/login'), (req, res) => {
			Trackers.destroy({
				where: {
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore
					user: req.user.user_id,
				},
			}).catch((e) => {
				this.logger.error(e);
			}).finally(() => {
				res.redirect('myAccount');
			});
		});
		this.web.get('/resetTracker', ensureLoggedIn('/login'), (req, res) => {
			const snowflake = req.query.snowflake;
			if (snowflake) {
				Trackers.update({
					triggered: false,
				}, {
					where: {
						msgsnowflake: snowflake,
					},
				}).finally(() => {
					res.redirect('myAccount');
				});
			} else {
				res.redirect('myAccount');
			}
		});
		this.web.get('/deleteTracker', ensureLoggedIn('/login'), (req, res) => {
			const snowflake = req.query.snowflake;
			if (snowflake) {
				Trackers.destroy({
					where: {
						msgsnowflake: snowflake,
					},
				}).finally(() => {
					res.redirect('myAccount');
				});
			} else {
				res.redirect('myAccount');
			}
		});
		this.web.get('/myAccount', ensureLoggedIn('/login'), (req, res) => {
			Trackers.findAll({
				where: {
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore
					user: req.user.user_id,
				},
				attributes: ['msgsnowflake', 'address', 'longitude', 'latitude', 'radius', 'notes', 'alert', 'triggered'],
			}).then((trackerModels: Model[]) => {
				const trackers = [];
				for (let i = 0; i < trackerModels.length; i++) {
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore
					trackers.push(trackerModels[i].dataValues);
				}
				res.render('myAccount', {
					data: Object.assign(Webserver.addUserData(req), {
						trackers: trackers,
					}),
				});
			}).catch((e) => {
				this.logger.error(e);
			});
		});
		this.logger.info('Webserver loaded.');
	}

	public start(): void {
		this.web.listen(this.port, '0.0.0.0',() => this.logger.info('Webserver started.'));
	}

	private static addUserData(req) {
		return {
			loggedIn: req.isAuthenticated(),
			userDisplay: req.user?.display,
			avatar: req.user?.avatar,
			provider: req.user?.provider,
		};
	}
}
