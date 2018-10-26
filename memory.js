const global = require("basescript");
const CONFIG = global.CONFIG;
const log = global.getLogger("memory");

const nedb = require("nedb");

const dbChats = new nedb({ filename: 'chats.db', autoload: true });
dbChats.persistence.setAutocompactionInterval(1000 * 30);

const dbWitnesses = new nedb({ filename: 'witnesses.db', autoload: true });
dbWitnesses.persistence.setAutocompactionInterval(1000 * 30);


const VERSION = 2;
class Chat {

    constructor(chat_id) {
        this.chat_id = chat_id;
        this.username = chat_id;
        this.watchall = true;
        this.witness = null;
        this.witnesses = [];
        this.version = VERSION;
    }

    fromJson(json) {
        this.chat_id = json.chat_id;
        this.username = json.username;
        this.witness = json.witness;

        //kind of migration
        if(json.witnesses) {
            this.witnesses = [...json.witnesses];
        }
        if(Object.keys(json).includes("watchall")) {
            this.watchall = json.watchall;
        } 
    }

    isWatching(witness) {
        if(this.watchall || !this.witness && !this.witnesses.length) {
            return true;
        }
        if(witness == this.witness) {
            return true;
        }

        if(this.witnesses.includes(witness)) {
            return true;
        }

        return false;
    }
}

async function loadChats() {
    return new Promise((resolve, reject) => {
        dbChats.find({}, {}, (err, chats) => {
            if (err) {
                reject(err);
            }
            
            if (chats) {
                const ret = [];
                for(let sc of chats) {
                    const chat = new Chat(sc.chat_id);
                    chat.fromJson(sc);
                    ret.push(chat);
                }
                resolve(ret);
            }
            resolve([])
        });
    });      
}

async function loadWitness(owner) {
    return new Promise((resolve, reject) => {
        dbWitnesses.findOne({owner}, {}, (err, witness) => {
            if (err) {
                reject(err);
            }
            log.trace("found witness", witness)
            resolve(witness);
        });
    });      
}


async function getChat(chat_id) {

    let chat =  await new Promise((resolve, reject) => {
        dbChats.findOne({chat_id}, {}, (err, chat) => {
            if(err) {
                reject(err);
            }
            log.debug("saved chat", chat_id, chat);
            if(!chat) {
                log.debug("no chat found resolve to null")
                resolve(null);
            } else {
                const chobj = new Chat(chat_id);
                chobj.fromJson(chat)
                resolve(chobj);
            }
        });
    });

    if(!chat) {
        chat = new Chat(chat_id);
        await saveChat(chat);
    }
    log.info("return chat", chat);
    return chat;
}


async function saveChat(chat) {
    if(!chat || !chat.chat_id) {
        throw Error("saveChat: chat.cha_id is empty!");
    }

    return new Promise((resolve, reject) => {
        dbChats.update({chat_id: chat.chat_id}, chat, {upsert:true}, (err, cnt) => {
            if(err) {
                reject(err);
            }
            log.debug("saved chat", chat);
            if(cnt == 0) {
                log.error("unknown chat", chat);
            }
            resolve(chat);
        });
    });
}

async function saveWitness(witness) {

    return new Promise((resolve, reject) => {
        dbWitnesses.update({owner:witness.owner}, witness, {upsert:true}, (err, cnt) => {
            if(err) {
                reject(err);
            }
            log.debug("saved witnesses", cnt);
            if(cnt == 0) {
                throw new Error("no witness chats!")
            }
            resolve(cnt);
        });
    });
}


module.exports.saveChat = saveChat;
module.exports.getChat = getChat;
module.exports.saveWitness = saveWitness;
module.exports.loadChats = loadChats;
module.exports.loadWitness = loadWitness;

