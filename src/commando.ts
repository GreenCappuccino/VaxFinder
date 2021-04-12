/*
import {
	Command,
	CommandDispatcher,
	CommandInfo,
	CommandoClient, CommandoClientOptions,
	CommandoMessage,
	CommandoRegistry, Inhibition, Inhibitor,
} from 'discord.js-commando';
import {ClientOptions, Message} from 'discord.js';
import {emit} from 'cluster';
import _ from 'lodash';

export class ExtendedClient extends CommandoClient {

	dispatcher: ExtendedDispatcher;

	constructor(options: CommandoClientOptions | ClientOptions = {}) {
		super(options);
		this.dispatcher = new ExtendedDispatcher(this, this.registry);
	}
}

export class ExtendedDispatcher extends CommandDispatcher {
	intercept: Interceptor;
	interceptPreProcessPatterns: Map<string, RegExp>;

	constructor(client: CommandoClient, registry: CommandoRegistry) {
		super(client, registry);
		this.intercept = () => null;

	}

	public handleMessage(message: ExtendedMessage, oldMessage: ExtendedMessage): Promise<void> {
		return new Promise<void>((resolve) => {
			if(!this.shouldHandleMessage(message, oldMessage)) return;

			let commandMessage = this.parseMessage(message);
			let commandOldMessage = oldMessage;
			if(oldMessage) {
				commandOldMessage = _.extend<ExtendedMessage>(this._results.get(oldMessage.id));
				if(!commandOldMessage && !this.client.options.nonCommandEditable) return;
				commandMessage = this.parseMessage(message);
				if(commandMessage && commandOldMessage) {
					commandMessage.responses = commandOldMessage.responses;
					commandMessage.responsePositions = commandOldMessage.responsePositions;
				}
			} else {
				commandMessage = this.parseMessage(message);
			}
			Promise.resolve(this.intercept(commandMessage, commandOldMessage)).then(([intMsg, intOldMsg]) => {
				if (intMsg.command === undefined) {
					resolve();
					return;
				}
				if (!(intMsg.command.preFlight instanceof Function))
					intMsg.command.preFlight = () => true;
				Promise.resolve(intMsg.command.preFlight()).then((preFlightValue: true | string) => {
					if (preFlightValue === true)
						super.handleMessage(intMsg, intOldMsg).then(() => {
							resolve();
						}).catch((e) => {
							emit('error', e);
						}).finally(() => {
							resolve();
						});
					else
						intMsg.reply(preFlightValue).then(() => {
							resolve();
						}).catch((e) => {
							emit('error', e);
						}).finally(() => {
							resolve();
						});
				}).catch((e) => {
					emit('error', e);
					resolve();
				});
			}).catch((e) => {
				emit('error', e);
				resolve();
			});
		});
	}

	protected parseMessage(msg: Message): ExtendedMessage {
		const message: CommandoMessage = super.parseMessage(msg);
		const extendedMessage: ExtendedMessage = _.extend<ExtendedMessage>(message);
		return extendedMessage;
	}
}

type Interceptor = (message: ExtendedMessage, oldMessage: ExtendedMessage) => [ExtendedMessage, ExtendedMessage] | Promise<[ExtendedMessage, ExtendedMessage]>;

export abstract class ExtendedCommand extends Command {
	preFlight: () => true | string | Promise<true | string> = () => true;
}

export interface ExtendedCommandInfo extends CommandInfo {
	preFlight?: () => true | string | Promise<true | string>;
}

export class ExtendedMessage extends CommandoMessage {
	command: ExtendedCommand;
}



 */
