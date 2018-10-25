const global = require("basescript");
const CONFIG = global.CONFIG;
const log = global.getLogger("telegram");

const telebot = require("telebot");

let bot = null;

async function send(chat_id, msg, kbd) {
    try {
        let opts = { parse: "Markdown" };
        log.debug("msg", msg);
        log.debug("kbd", kbd);
        if (kbd) {
            opts.markup = kbd;
        }
        return bot.sendMessage(chat_id, msg, opts)
    } catch(e) {
        log.error("unable to send message")
        log.error(e);
    }
}

async function init(onMsg) {

    bot = new telebot({
        token: CONFIG.telegram.token,
        polling: {
            interval: 1000, // Optional. How often check updates (in ms). 
            timeout: 60,
            limit: 100,  //updates
            retryTimeout: 5000
        },
        usePlugins: ['commandButton']
    });

    bot.on('text', onMsg); 

    bot.connect();

}


module.exports.init = init;
module.exports.send = send;