"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cli_color_1 = __importDefault(require("cli-color"));
const fs_1 = __importDefault(require("fs"));
const readline_1 = __importDefault(require("readline"));
const matrix_js_sdk_1 = __importStar(require("matrix-js-sdk"));
const membership_js_1 = require("matrix-js-sdk/lib/@types/membership.js");
var myHomeServer = "https://matrix.org";
var myUserId = "@kjniemela:matrix.org";
var myAccessToken = "mat_srUoSdbvSCd1fXijtZpbo5uSdWICOG_Ak26b2";
var matrixClient = matrix_js_sdk_1.default.createClient({
    baseUrl: myHomeServer,
    accessToken: myAccessToken,
    userId: myUserId,
});
// Data structures
var roomList = [];
var viewingRoom = null;
var numMessagesToShow = 20;
// Reading from stdin
var CLEAR_CONSOLE = "\x1B[2J";
var rl = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: completer,
});
rl.setPrompt("$ ");
rl.on("line", function (line) {
    if (line.trim().length === 0) {
        rl.prompt();
        return;
    }
    if (line === "/help") {
        printHelp();
        rl.prompt();
        return;
    }
    if (viewingRoom) {
        if (line === "/exit") {
            viewingRoom = null;
            printRoomList();
        }
        else if (line === "/members") {
            printMemberList(viewingRoom);
        }
        else if (line === "/roominfo") {
            printRoomInfo(viewingRoom);
        }
        else if (line === "/resend") {
            // get the oldest not sent event.
            var notSentEvent;
            for (var i = 0; i < viewingRoom.timeline.length; i++) {
                if (viewingRoom.timeline[i].status == matrix_js_sdk_1.default.EventStatus.NOT_SENT) {
                    notSentEvent = viewingRoom.timeline[i];
                    break;
                }
            }
            if (notSentEvent) {
                matrixClient.resendEvent(notSentEvent, viewingRoom).then(function () {
                    printMessages();
                    rl.prompt();
                }, function (err) {
                    printMessages();
                    print("/resend Error: %s", err);
                    rl.prompt();
                });
                printMessages();
                rl.prompt();
            }
        }
        else if (line.indexOf("/more ") === 0) {
            var amount = parseInt(line.split(" ")[1]) || 20;
            matrixClient.scrollback(viewingRoom, amount).then(function (room) {
                printMessages();
                rl.prompt();
            }, function (err) {
                print("/more Error: %s", err);
            });
        }
        else if (line.indexOf("/invite ") === 0) {
            var userId = line.split(" ")[1].trim();
            matrixClient.invite(viewingRoom.roomId, userId).then(function () {
                printMessages();
                rl.prompt();
            }, function (err) {
                print("/invite Error: %s", err);
            });
        }
        else if (line.indexOf("/file ") === 0) {
            var filename = line.split(" ")[1].trim();
            let buffer = fs_1.default.readFileSync("./your_file_name");
            matrixClient.uploadContent(new Blob([buffer])).then(function (response) {
                matrixClient.sendMessage(viewingRoom.roomId, {
                    msgtype: matrix_js_sdk_1.MsgType.File,
                    body: filename,
                    url: response.content_uri,
                });
            });
        }
        else {
            matrixClient.sendTextMessage(viewingRoom.roomId, line).finally(function () {
                printMessages();
                rl.prompt();
            });
            // print local echo immediately
            printMessages();
        }
    }
    else {
        if (line.indexOf("/join ") === 0) {
            var roomIndex = line.split(" ")[1];
            viewingRoom = roomList[roomIndex];
            if (viewingRoom.getMember(myUserId).membership === membership_js_1.KnownMembership.Invite) {
                // join the room first
                matrixClient.joinRoom(viewingRoom.roomId).then(function (room) {
                    setRoomList();
                    viewingRoom = room;
                    printMessages();
                    rl.prompt();
                }, function (err) {
                    print("/join Error: %s", err);
                });
            }
            else {
                printMessages();
            }
        }
    }
    rl.prompt();
});
// ==== END User input
// show the room list after syncing.
matrixClient.on(matrix_js_sdk_1.ClientEvent.Sync, function (state, prevState, data) {
    switch (state) {
        case "PREPARED":
            setRoomList();
            printRoomList();
            printHelp();
            rl.prompt();
            break;
    }
});
matrixClient.on(matrix_js_sdk_1.ClientEvent.Room, function () {
    setRoomList();
    if (!viewingRoom) {
        printRoomList();
        rl.prompt();
    }
});
// print incoming messages.
matrixClient.on(matrix_js_sdk_1.RoomEvent.Timeline, function (event, room, toStartOfTimeline) {
    if (toStartOfTimeline) {
        return; // don't print paginated results
    }
    if (!viewingRoom || viewingRoom.roomId !== room?.roomId) {
        return; // not viewing a room or viewing the wrong room.
    }
    printLine(event);
});
function setRoomList() {
    roomList = matrixClient.getRooms();
    roomList.sort(function (a, b) {
        // < 0 = a comes first (lower index) - we want high indexes = newer
        var aMsg = a.timeline[a.timeline.length - 1];
        if (!aMsg) {
            return -1;
        }
        var bMsg = b.timeline[b.timeline.length - 1];
        if (!bMsg) {
            return 1;
        }
        if (aMsg.getTs() > bMsg.getTs()) {
            return 1;
        }
        else if (aMsg.getTs() < bMsg.getTs()) {
            return -1;
        }
        return 0;
    });
}
function printRoomList() {
    print(CLEAR_CONSOLE);
    print("Room List:");
    var fmts = {
        invite: cli_color_1.default.cyanBright,
        leave: cli_color_1.default.blackBright,
    };
    for (var i = 0; i < roomList.length; i++) {
        var msg = roomList[i].timeline[roomList[i].timeline.length - 1];
        var dateStr = "---";
        var fmt;
        if (msg) {
            dateStr = new Date(msg.getTs()).toISOString().replace(/T/, " ").replace(/\..+/, "");
        }
        var myMembership = roomList[i].getMyMembership();
        if (myMembership) {
            fmt = fmts[myMembership];
        }
        var roomName = fixWidth(roomList[i].name, 25);
        print("[%s] %s (%s members)  %s", i, fmt ? fmt(roomName) : roomName, roomList[i].getJoinedMembers().length, dateStr);
    }
}
function printHelp() {
    var hlp = cli_color_1.default.italic.white;
    print("Global commands:", hlp);
    print("  '/help' : Show this help.", cli_color_1.default.white);
    print("Room list index commands:", hlp);
    print("  '/join <index>' Join a room, e.g. '/join 5'", cli_color_1.default.white);
    print("Room commands:", hlp);
    print("  '/exit' Return to the room list index.", cli_color_1.default.white);
    print("  '/members' Show the room member list.", cli_color_1.default.white);
    print("  '/invite @foo:bar' Invite @foo:bar to the room.", cli_color_1.default.white);
    print("  '/more 15' Scrollback 15 events", cli_color_1.default.white);
    print("  '/resend' Resend the oldest event which failed to send.", cli_color_1.default.white);
    print("  '/roominfo' Display room info e.g. name, topic.", cli_color_1.default.white);
}
function completer(line) {
    var completions = ["/help", "/join ", "/exit", "/members", "/more ", "/resend", "/invite"];
    var hits = completions.filter(function (c) {
        return c.indexOf(line) == 0;
    });
    // show all completions if none found
    return [hits.length ? hits : completions, line];
}
function printMessages() {
    if (!viewingRoom) {
        printRoomList();
        return;
    }
    print(CLEAR_CONSOLE);
    var mostRecentMessages = viewingRoom.timeline;
    for (var i = 0; i < mostRecentMessages.length; i++) {
        printLine(mostRecentMessages[i]);
    }
}
function printMemberList(room) {
    var fmts = {
        join: cli_color_1.default.green,
        ban: cli_color_1.default.red,
        invite: cli_color_1.default.blue,
        leave: cli_color_1.default.blackBright,
    };
    var members = room.currentState.getMembers();
    // sorted based on name.
    members.sort(function (a, b) {
        if (a.name > b.name) {
            return -1;
        }
        if (a.name < b.name) {
            return 1;
        }
        return 0;
    });
    print('Membership list for room "%s"', room.name);
    print(new Array(room.name.length + 28).join("-"));
    room.currentState.getMembers().forEach(function (member) {
        if (!member.membership) {
            return;
        }
        var fmt = fmts[member.membership] ||
            function (a) {
                return a;
            };
        var membershipWithPadding = member.membership + new Array(10 - member.membership.length).join(" ");
        print("%s" + fmt(" :: ") + "%s" + fmt(" (") + "%s" + fmt(")"), membershipWithPadding, member.name, member.userId === myUserId ? "Me" : member.userId, fmt);
    });
}
function printRoomInfo(room) {
    var eventMap = room.currentState.events;
    var eTypeHeader = "    Event Type(state_key)    ";
    var sendHeader = "        Sender        ";
    // pad content to 100
    var restCount = 100 - "Content".length - " | ".length - " | ".length - eTypeHeader.length - sendHeader.length;
    var padSide = new Array(Math.floor(restCount / 2)).join(" ");
    var contentHeader = padSide + "Content" + padSide;
    print(eTypeHeader + sendHeader + contentHeader);
    print(new Array(100).join("-"));
    eventMap.keys().forEach(function (eventType) {
        if (eventType === matrix_js_sdk_1.EventType.RoomMember) {
            return;
        } // use /members instead.
        var eventEventMap = eventMap.get(eventType);
        eventEventMap.keys().forEach(function (stateKey) {
            var typeAndKey = eventType + (stateKey.length > 0 ? "(" + stateKey + ")" : "");
            var typeStr = fixWidth(typeAndKey, eTypeHeader.length);
            var event = eventEventMap.get(stateKey);
            var sendStr = fixWidth(event.getSender(), sendHeader.length);
            var contentStr = fixWidth(JSON.stringify(event.getContent()), contentHeader.length);
            print(typeStr + " | " + sendStr + " | " + contentStr);
        });
    });
}
function printLine(event) {
    var fmt;
    var name = event.sender ? event.sender.name : event.getSender();
    var time = new Date(event.getTs()).toISOString().replace(/T/, " ").replace(/\..+/, "");
    var separator = "<<<";
    if (event.getSender() === myUserId) {
        name = "Me";
        separator = ">>>";
        if (event.status === matrix_js_sdk_1.default.EventStatus.SENDING) {
            separator = "...";
            fmt = cli_color_1.default.xterm(8);
        }
        else if (event.status === matrix_js_sdk_1.default.EventStatus.NOT_SENT) {
            separator = " x ";
            fmt = cli_color_1.default.redBright;
        }
    }
    var body = "";
    var maxNameWidth = 15;
    if (name.length > maxNameWidth) {
        name = name.slice(0, maxNameWidth - 1) + "\u2026";
    }
    if (event.getType() === matrix_js_sdk_1.EventType.RoomMessage) {
        body = event.getContent().body;
    }
    else if (event.isState()) {
        var stateName = event.getType();
        if (event.getStateKey().length > 0) {
            stateName += " (" + event.getStateKey() + ")";
        }
        body = "[State: " + stateName + " updated to: " + JSON.stringify(event.getContent()) + "]";
        separator = "---";
        fmt = cli_color_1.default.xterm(249).italic;
    }
    else {
        // random message event
        body = "[Message: " + event.getType() + " Content: " + JSON.stringify(event.getContent()) + "]";
        separator = "---";
        fmt = cli_color_1.default.xterm(249).italic;
    }
    if (fmt) {
        print("[%s] %s %s %s", time, name, separator, body, fmt);
    }
    else {
        print("[%s] %s %s %s", time, name, separator, body);
    }
}
function print(str, formatter) {
    if (typeof arguments[arguments.length - 1] === "function") {
        // last arg is the formatter so get rid of it and use it on each
        // param passed in but not the template string.
        var newArgs = [];
        var i = 0;
        for (i = 0; i < arguments.length - 1; i++) {
            newArgs.push(arguments[i]);
        }
        var fmt = arguments[arguments.length - 1];
        for (i = 0; i < newArgs.length; i++) {
            newArgs[i] = fmt(newArgs[i]);
        }
        console.log.apply(console.log, newArgs);
    }
    else {
        console.log.apply(console.log, [...arguments]);
    }
}
function fixWidth(str, len) {
    if (str.length > len) {
        return str.substring(0, len - 2) + "\u2026";
    }
    else if (str.length < len) {
        return str + new Array(len - str.length).join(" ");
    }
    return str;
}
matrixClient.startClient({ initialSyncLimit: numMessagesToShow });
