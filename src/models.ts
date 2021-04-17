import {DataTypes, Sequelize} from 'sequelize';
import path from 'path';
import fs from 'fs';
import session from 'express-session';
import 'connect-session-sequelize';
import connect_session_sequelize from 'connect-session-sequelize';

if (!fs.existsSync(path.join(__dirname, 'db'))) fs.mkdirSync(path.join(__dirname, 'db'));

const originDB: Sequelize = new Sequelize('database', 'user', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: path.join(__dirname, 'db', 'origins.sqlite'),
});

const SessionStore = connect_session_sequelize(session.Store);
export const Sessions = new SessionStore({
	db: originDB,
	tableName: 'sessions',
});

export const Passports = originDB.define('passports', {
	userid: {
		type: DataTypes.STRING,
		unique: true,
	},
	avatar: DataTypes.STRING,
	display: DataTypes.STRING,
	username: DataTypes.STRING,
	provider: DataTypes.STRING,
});

export const Trackers = originDB.define('trackers', {
	msgsnowflake: {
		type: DataTypes.STRING,
		unique: true,
	},
	user: DataTypes.STRING,
	address: DataTypes.TEXT,
	longitude: DataTypes.DOUBLE,
	latitude: DataTypes.DOUBLE,
	radius: DataTypes.DOUBLE,
	notes: DataTypes.TEXT,
	alert: DataTypes.TEXT, // Webhook to fire into (IFTTT format)
	triggered: DataTypes.BOOLEAN,
});

export const Users = originDB.define('users', {
	userid: {
		type: DataTypes.STRING,
		unique: true,
	},
	username: DataTypes.STRING,
	trackerCount: DataTypes.INTEGER,
});

export const syncModels = () => {
	Sessions.sync();
	Passports.sync();
	Trackers.sync();
	Users.sync();
};
