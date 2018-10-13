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

async function processMessage(chat_id, username, msg) {
    if(!msg || !msg.match("^[a-z0-9.-]+$")) {
        await telegram.send(chat_id, "Введенное не является именем делегата");
        return;
    }
    const witness = await viz.api.getWitnessByAccountAsync(msg);
    if(!witness || !witness.owner || witness.owner != msg) {
        await telegram.send(chat_id, "Такой делегат не найден");
        return;
    }
    await memory.saveChat(chat_id, username, msg);
    await telegram.send(chat_id, "Добро пожаловать делегат @" + msg + "!");
}

async function onMsg(msg) {
    log.trace("onMsg", msg);
    const chat_id = msg.from.id; 
    const username = msg.from.username;
    switch(msg.text) {
        case "/start": {
            await memory.saveChat(chat_id, username);
            await telegram.send(chat_id, "Привет, я бот, который наблюдает за делегатами. Введи имя делегата, если хочешь получать персонализированные уведомления.")
        }; break;
        default:
            await processMessage(chat_id, username, msg.text);
    }
}

async function inform(chat, witness, missed) {
    let username = (chat.witness == witness.owner?" (@"+chat.username+")":"");
    await telegram.send(chat.chat_id, `Делегат ${witness.owner}${username} пропустил ${missed} блоков!`);
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

                let missed = 0;
                let saved = await memory.loadWitness(w.owner);

                log.debug("witness", w.owner, "missed", w.total_missed)

                if(saved) {
                    log.debug("\tsaved missed blocks", saved.total_missed, "prev_missed", saved.prev_missed);
                    missed =  w.total_missed - saved.total_missed;
                    if(missed) {
                        let chats = await memory.loadChats();
                        
                        for(let chat of chats) {
                            await inform(chat, w, missed);
                        }
                    }
                } 

                if(!saved || w.total_missed !== saved.total_missed || missed !== saved.prev_missed) {
                    log.debug("\tsave witness", w.owner);
                    w.prev_missed = missed;
                    await memory.saveWitness(w);
                }
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

        process.exit(1);
    }
    last_bn = bn;
}, LONG_DELAY); 

run();
