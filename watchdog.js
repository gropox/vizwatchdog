const global = require("basescript");

global.initApp("vizwatchdog");
const log = global.getLogger("index");
const CONFIG = global.CONFIG;
const viz = require("viz-world-js");

if(CONFIG.ws) {
    viz.config.set("websocket", CONFIG.ws);
}

const telegram = require("./telegram");
const memory = require("./memory");
const m = require("./messages");
const check = require("./check");

async function processMessage(chat, msg) {
    if(!msg || !msg.match("^[a-z0-9.-]+$")) {
        await telegram.send(chat.chat_id, "Введенное не является именем делегата");
        return;
    }
    const witness = await viz.api.getWitnessByAccountAsync(msg);
    if(!witness || !witness.owner || witness.owner != msg) {
        await telegram.send(chat.chat_id, "Такой делегат не найден");
        return;
    }
    chat.witness = msg;
    await telegram.send(chat.chat_id, "Добро пожаловать делегат @" + msg + "!");
}

async function switchWatchAll(chat) {
    chat.watchall = !chat.watchall;
    await telegram.send(chat.chat_id, m.watchall_switch(chat));
}

async function onMsg(msg) {
    log.trace("onMsg", msg);
    const chat_id = msg.from.id; 
    const username = msg.from.username;
    try {

        const chat = await memory.getChat(chat_id);
        chat.username = username; //update always, can change
    
        switch(msg.text) {
            case "/start": {
                chat.username = username;
                chat.witness = null;
                await telegram.send(chat_id, "Привет, я бот, который наблюдает за делегатами. Введи имя делегата, если хочешь получать персонализированные уведомления.")
            }; break;
            case "/help": {
                await telegram.send(chat_id, m.help())
            }; break;
            case "/watchall": {
                await switchWatchAll(chat);
            }; break;
            default:
                await processMessage(chat, msg.text);
        }
        await memory.saveChat(chat);
    } catch(e) {
        log.error("Error in onMsg", e)
    }
}

let PROPS = null;

const DELAY = 1000 * 60 * 3;
const LONG_DELAY = 1000 * 60 * 15;

let bn = 0;
let last_bn = 0;
let delay = DELAY;

async function run() {

    await telegram.init(onMsg);

    while (true) {
        try {
            PROPS = await viz.api.getDynamicGlobalPropertiesAsync();
            bn = PROPS.head_block_number;

            const witnesses = await viz.api.getWitnessesByVoteAsync("",100);

            for(let w of witnesses) {

                let saved = await memory.loadWitness(w.owner);

                log.debug("witness", w.owner, "missed", w.total_missed)

                if(saved) {

                    /**************************/
                    /*         CHECKS         */
                    /**************************/

                    await check(w, saved);

                    
                } 


                await memory.saveWitness(w);
            }
        } catch (e) {
            log.error("error in main loop", e);
        }
        await global.sleep(delay);
    }
}

setInterval(() => {
    log.info("watchdog", last_bn, bn);
    if(last_bn == bn) {

        //TODO: inform admin about stop
        try {
            telegram.send(CONFIG.telegram.admin_chat, `Watchdog перестал получать новые блоки и будет перезагружен`).then(() => {
                process.exit(1);
            });
        } catch(e) {
            process.exit(1);
        }
    }
    last_bn = bn;
}, LONG_DELAY); 

run();