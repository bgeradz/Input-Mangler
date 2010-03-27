// This is an early attempt to create a JavaScript API for common input-mangler tasks.
// Will definitely be reworked, consider it rough brain storming code.

include('keysyms.js');
include('keynames.js');

// when aux key is pressed the aux mode is not activated immediately, but after this time period
var AUX_SOFT_TIMEOUT = 25; // ms

// when aux key is released, the aux key's own character is emitted only if the aux key has been pressed for at most this long
var AUX_HARD_TIMEOUT = 200; // ms

var AUX_MOUSE_SWITCH = KEY_CAPSLOCK;

function MAP_SPACE(map) {
	// arrows
	map(KEY_J, KC(KEY_LEFT));
	map(KEY_L, KC(KEY_RIGHT));
	map(KEY_I, KC(KEY_UP));
	map(KEY_K, KC(KEY_DOWN));

	// enter
	map(KEY_N, KC(KEY_ENTER));

	// ctrl + keys
	map(KEY_Z, KCX(KEY_RIGHTCTRL, KEY_Z));
	map(KEY_X, KCX(KEY_RIGHTCTRL, KEY_X));
	map(KEY_C, KCX(KEY_RIGHTCTRL, KEY_C));
	map(KEY_V, KCX(KEY_RIGHTCTRL, KEY_V));
	
	// desktop switching
	map(KEY_S, KCX(KEY_LEFTALT, KEY_LEFT));
	map(KEY_F, KCX(KEY_LEFTALT, KEY_RIGHT));
	map(KEY_E, KCX(KEY_LEFTALT, KEY_UP));
	map(KEY_D, KCX(KEY_LEFTALT, KEY_DOWN));

	// backspace / delete
	map(KEY_H, KC(KEY_BACKSPACE));
	map(KEY_G, KC(KEY_DELETE));

	// home / end
	map(KEY_U, KC(KEY_HOME));
	map(KEY_O, KC(KEY_END));
	
	// page up/down
	map(KEY_P, KC(KEY_PAGEUP));
	map(KEY_SEMICOLON, KC(KEY_PAGEDOWN));

	// layout switch (kde combi)
	map(KEY_Q, KCX(KEY_LEFTCTRL, KEY_LEFTALT, KEY_K) );

	// Doesn't work in anything else than xterm :(
	// german letters
	map(KEY_RIGHTBRACE, function() {
		return emitter.isShift() ?
		KCX(KEY_RIGHTALT, KEY_BACKSLASH) : // UE
		KCX(KEY_RIGHTALT, KEY_LEFTSHIFT, KEY_BACKSLASH) //ue
	});
	map(KEY_APOSTROPHE, function() {
		return emitter.isShift() ?
		KCX(KEY_RIGHTALT, KEY_LEFTSHIFT, KEY_D) : // AE
		KCX(KEY_RIGHTALT, KEY_D) //ae
	});
	map(KEY_LEFTBRACE, function() {
		return emitter.isShift() ?
		KCX(KEY_RIGHTALT, KEY_LEFTSHIFT, KEY_V) : // OE
		KCX(KEY_RIGHTALT, KEY_V) //oe
	});
	map(KEY_MINUS, KCX(KEY_RIGHTALT, KEY_LEFTSHIFT, KEY_MINUS)); // SZ

}

PASS = function(skip) {
	skip(KEY_LEFTSHIFT);
	skip(KEY_RIGHTSHIFT);

	skip(KEY_LEFTCTRL);
	skip(KEY_RIGHTCTRL);

	skip(KEY_LEFTALT);
	skip(KEY_RIGHTALT);
}

function MAP_REPLACE(map) {
	map(KEY_102ND, KEY_LEFTSHIFT);
}

var MOUSE_CONF = {
	maxSpeed : 15,

	accelSpeed : 0.3,
	reverseSpeed : 0.5,
	frictionSpeed : 1000
}

//####################

// key combination honoring help keys
function KC() {
	return new KeyCombination(arguments);
}
// key combination ignoring help keys
function KCX() {
	var kc = new KeyCombination(arguments);
	kc.setPreserveHelpKeys(false);
	return kc;
}

function Emitter() {
	this.pressedKeys = {};
}

Emitter.prototype.emitEvent = function(ev) {
	this.emit(ev.type, ev.code, ev.value);
}

Emitter.prototype.emit = function(type, code, value) {
	if (type == EV_KEY)
		this.emitKey(code, value);
	else
		emit(type, code, value);
}

Emitter.prototype.emitKey = function(code, value) {
	if (this.pressedKeys[code]) {
		switch (value) {
			case 1:
				return;
			case 2:
				this._emitKey(code, value);
				break;
			case 0:
				delete this.pressedKeys[code];
				this._emitKey(code, value);
				break;
		}
	} else {
		switch (value) {
			case 1:
			case 2:
				this.pressedKeys[code] = value;
				this._emitKey(code, value);
				break;
			case 0:
				return;
		}
	}
}
Emitter.prototype.releaseAllKeys = function() {
	for (var code in this.pressedKeys) {
		this._emitKey(code, 0);
	}
	this.pressedKeys = {};
}
Emitter.prototype.releaseAllKeysExcept = function(except) {
	var codes = [];
	for (var code in this.pressedKeys)
		codes.push(code);
	for (var i = 0; i < codes.length; i++) {
		var code = codes[i];
		if (! except[code]) {
			this._emitKey(code, 0);
			delete this.pressedKeys[code];
		}
	}
}
Emitter.prototype.isPressed = function(code) {
	return this.pressedKeys[code.toString()];
}


Emitter.prototype.isShift = function() {
	return this.pressedKeys[KEY_LEFTSHIFT.toString()] ||
		this.pressedKeys[KEY_RIGHTSHIFT.toString()];
}

Emitter.prototype._emitKey = function(code, value) {
	log("EMIT KEY: "+ sym(code)+ "("+ code +") - "+ value);
	emit(EV_KEY, code, value);
}


emitter = new Emitter();


EventHandler = function() {
	
}
EventHandler.prototype.handleEvent = function(event) {
	
}

// ends processing by this handler
EventHandler.prototype.next = function() {
	throw 'next';
}

EventHandler.prototype.last = function() {
	throw 'last';
}

// suppress current event
EventHandler.prototype.suppress = function() {
	throw 'suppress';
}


EventHandlerChain = function() {
	this.handlers = [];
}
EventHandlerChain.prototype.add = function(handler) {
	this.handlers.push(handler);
}
EventHandlerChain.prototype.handleEvent = function(event) {
	for (var i = 0; i < this.handlers.length; i++) {
		try {
			this.handlers[i].handleEvent(event);
		} catch (e) {
			if (e == 'suppress')
				return;
			if (e == 'last')
				break;
			if (e == 'next')
				continue;
			throw e;
		}
	}
	emitter.emitEvent(event);
}


AuxHandler = function(auxCode) {
	this.auxCode = auxCode;
	this.auxTime = null;
	this.auxMap = {};
	this.passMap = {}
}
AuxHandler.prototype = new EventHandler();

AuxHandler.prototype.map = function(src, dest) {
	this.auxMap[src.toString()] = dest;
}
AuxHandler.prototype.pass = function(code) {
	this.passMap[code.toString()] = true;
}

AuxHandler.prototype.handleEvent = function(ev) {
	if (ev.type == EV_TIMER)
		this.processTimer();
	if (! ev.type == EV_KEY)
		this.next();
	if (ev.value > 0)
		this.keyPress(ev.code, ev.value);
	else
		this.keyRelease(ev.code);
}
AuxHandler.prototype.processTimer = function() {
	if (this.preAux && (time() - this.auxTime > AUX_SOFT_TIMEOUT)) {
		this.aux = true;
		emitter.releaseAllKeysExcept(this.passMap);
	}
}

AuxHandler.prototype.keyPress = function(code, value) {
	if (code == this.auxCode) {
		if (! this.preAux) {
			/*
			this.aux = true;
			this.auxTime = time();
			emitter.releaseAllKeysExcept(this.passMap);
			*/
			if (! this.preAux) {
				this.preAux = true;
				this.auxTime = time();
			}
		}
		this.suppress();
	}
	if (this.aux) {
		this.translate(code, value);
		this.suppress();
	}
	if (this.preAux) {
		// aux + key pressed too quickly to be interpreted as aux sequence, thus, terminating aux mode.
		// emitting the orig aux code.
		emitter.emitKey(this.auxCode, 1);
		emitter.emitKey(this.auxCode, 0);
		this.aux = false;
		this.preAux = false;
		this.auxTime = null;
	}
}

AuxHandler.prototype.keyRelease = function(code) {
	if (code == this.auxCode && this.aux) {
		if (time() - this.auxTime <= AUX_HARD_TIMEOUT) {
			// emit the original AUX_SWITCH key press/release
			emitter.emitKey(this.auxCode, 1);
			emitter.emitKey(this.auxCode, 0);
		}
		emitter.releaseAllKeysExcept(this.passMap);
		this.aux = false;
		this.preAux = false;
		this.auxTime = null;
		this.suppress();
	}
	if (this.aux) {
		this.translate(code, 0);
		this.suppress();
	}
}

AuxHandler.prototype.translate = function(code, value) {
	var k = code.toString();
	if (this.passMap[k])
		this.next();

	var dest = this.auxMap[""+code];
	if (! dest)
		return;

	if (typeof(dest) == 'function')
		dest = dest.call(this, code, value);

	if (value) {
		if (typeof(dest) == 'object' && dest.emit) { // object having an emit() method
			dest.emit();
		} else { // just an integer code
			new KeyCombination(dest).emit();
		}
	}
}


AuxMouseHandler = function(auxCode, conf) {
	this.auxCode = auxCode;
	this.conf = conf;
	this.axisX = {
		dir : 0,
		speed : 0,
		rest : 0,
		relEv: REL_X
	};
	this.axisY = {
		dir : 0,
		speed : 0,
		rest : 0,
		relEv: REL_Y
	};
}
AuxMouseHandler.prototype = new AuxHandler();
AuxMouseHandler.prototype.handleEvent = function(ev) {
	if (ev.type == EV_TIMER) {
		var resX = this.mouseEmu(this.axisX);
		var resY = this.mouseEmu(this.axisY);
		if (resX || resY)
			emitter.emit(EV_SYN, SYN_REPORT, 0);
	} else {
		AuxHandler.prototype.handleEvent.call(this, ev);
	}
}

AuxMouseHandler.prototype.translate = function(code, value) {
	switch (code) {
		// mouse
		case KEY_J: // left
			this.axisX.dir = value ? -1 : 0;
			break;
		case KEY_L:
			this.axisX.dir = value ? 1 : 0;
			break;
		case KEY_I:
			this.axisY.dir = value ? -1 : 0;
			break;
		case KEY_K:
			this.axisY.dir = value ? 1 : 0;
			break;

		case KEY_U:
			emitter.emitKey(BTN_LEFT, value);
			emitter.emit(EV_SYN, SYN_REPORT, 0);
			break;
		case KEY_O:
			emitter.emitKey(BTN_RIGHT, value);
			emitter.emit(EV_SYN, SYN_REPORT, 0);
			break;
		case KEY_8:
			emitter.emitKey(BTN_MIDDLE, value);
			emitter.emit(EV_SYN, SYN_REPORT, 0);
			break;

		default:
			AuxHandler.prototype.translate.call(this, code, value);
	}
	this.suppress();
}
AuxMouseHandler.prototype.mouseEmu = function(axis) {
	if (axis.dir) {
		if (axis.speed == 0) {
			axis.speed = this.conf.accelSpeed * axis.dir;
		}
		else if (axis.dir * axis.speed > 0) {// same direction
			axis.speed += this.conf.accelSpeed * axis.dir;
			if (abs(axis.speed) > this.conf.maxSpeed)
				axis.speed = this.conf.maxSpeed * axis.dir;
		} else { // different directions
			axis.speed -= this.conf.reverseSpeed * axis.dir;
		}
	} else { // speed down when no accel key is pressed
		if (axis.speed != 0) {
			if (axis.speed > 0) {
				axis.speed -= this.conf.frictionSpeed ;
				if (axis.speed < 0)
					axis.speed = 0;
			} else {
				axis.speed += this.conf.frictionSpeed ;
				if (axis.speed > 0)
					axis.speed = 0;
			}
		}
	}

	if (axis.speed != 0) {
		axis.rest += axis.speed;
		var full;
		if (axis.rest > 0) {
			full = floor(axis.rest);
			axis.rest -= full;
		} else {
			full = ceil(axis.rest);
			axis.rest -= full;
		}		
		if (full != 0) {
			emitter.emit(EV_REL, axis.relEv, full);
			return true;
		}
	}
	return false;
}

// class represents a key combination.
// pass codes as an array as a single argument or as arguments
KeyCombination = function() {
	if (typeof(arguments[0] == 'object'))
		this.codes = arguments[0];
	else
		this.codes = arguments;
	this.KC = true;
	this.preserveHelpKeys = true;
}
KeyCombination.prototype.setPreserveHelpKeys = function(flag) {
	this.preserveHelpKeys = flag;
}
KeyCombination.prototype.emit = function() {
	if (this.preserveHelpKeys)
		this.emit_preserveHelpKeys();
	else
		this.emit_ignoreHelpKeys();
}

KeyCombination.prototype.emit_ignoreHelpKeys = function() {
	var i;

	var sk = [KEY_LEFTSHIFT, KEY_RIGHTSHIFT, KEY_LEFTCTRL, KEY_RIGHTCTRL];
	var codes = this.codes;
	var saved = [];
	// saving state of helper keys
	for (i = 0; i < sk.length; i++) {
		var k = sk[i];
		if (emitter.isPressed(k)) {
			saved.push(k);
			emitter.emitKey(k, 0);
		};
	}

	// emitting combination
	for (i = 0; i < codes.length; i++) 
		emitter.emitKey(codes[i], 1);
	for (i = codes.length - 1; i >= 0; i--)
		emitter.emitKey(codes[i], 0);

	// restoring helper keys
	for (i = 0; i < saved.length; i++) {
		var k = saved[i];
		emitter.emitKey(k, 1);
	}
}

KeyCombination.prototype.emit_preserveHelpKeys = function() {
	var codes = this.codes;
	// emitting combination
	for (i = 0; i < codes.length; i++) 
		emitter.emitKey(codes[i], 1);
	for (i = codes.length - 1; i >= 0; i--)
		emitter.emitKey(codes[i], 0);
}

ReplaceKeyHandler = function() {
	this.keyMap = {};
}
ReplaceKeyHandler.prototype = new EventHandler();
ReplaceKeyHandler.prototype.map = function(src, dest) {
	this.keyMap[src.toString()] = dest;
}
ReplaceKeyHandler.prototype.handleEvent = function(ev) {
	if (ev.type != EV_KEY)
		this.next();
	var dest = this.keyMap[ev.code];
	if (dest)
		ev.code = dest;
}


var chain = new EventHandlerChain();

// simple key replacer
var repl = new ReplaceKeyHandler();
MAP_REPLACE(function(src, dest) {
	 repl.map(src, dest);
});
chain.add(repl);

// SPACE combis
var aux_space = new AuxHandler(KEY_SPACE);
MAP_SPACE(function(src, dest) {
	 aux_space.map(src, dest);
});
PASS(function(src, dest) {
	 aux_space.pass(src, dest);
});
chain.add(aux_space);


/*
// TAB combis
var aux_tab = new AuxHandler(KEY_TAB);
MAP_TAB(function(src, dest) {
	 aux_tab.map(src, dest);
});
chain.add(aux_tab);
*/

// MOUSE control
var aux_mouse = new AuxMouseHandler(AUX_MOUSE_SWITCH, MOUSE_CONF);
PASS(function(src, dest) {
	 aux_mouse.pass(src, dest);
});
chain.add(aux_mouse);

function process(ev) {
	chain.handleEvent(ev);
}

