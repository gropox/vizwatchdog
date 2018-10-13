const global = require("basescript");
const CONFIG = global.CONFIG;
const log = global.getLogger("memory");

const nedb = require("nedb");

const dbChats = new nedb({ filename: 'chats.db', autoload: true });
dbChats.persistence.setAutocompactionInterval(1000 * 30);

const dbWitnesses = new nedb({ filename: 'witnesses.db', autoload: true });
dbWitnesses.persistence.setAutocompactionInterval(1000 * 30);

async function loadChats() {
    return new Promise((resolve, reject) => {
        dbChats.find({}, {}, (err, chats) => {
            if (err) {
                reject(err);
            }
            
            if (chats) {
                resolve(chats);
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

async function saveChat(chat_id, username, witness) {

    return new Promise((resolve, reject) => {
        dbChats.update({chat_id}, {chat_id, username, witness}, {upsert:true}, (err, cnt) => {
            if(err) {
                reject(err);
            }
            log.debug("saved chat", chat_id, username, witness);
            if(cnt == 0) {
                throw new Error("no chats!")
            }
            resolve(cnt);
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
module.exports.saveWitness = saveWitness;
module.exports.loadChats = loadChats;
module.exports.loadWitness = loadWitness;

