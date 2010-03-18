/* This class can convert key events to the characters and vice versa */

include('keysyms.js');

function TextMapper(layout) {
	this.layout = layout;

	// building reverse layout lookup map
	var rev = {}; // reverse layout
	for (var key in layout) {
		var val = layout[key];
		var revKey;
		if (typeof(val) == 'object') { // array
			revKey = val.join('-');
		} else {
			revKey = val.toString();
		}
		rev[revKey] = key;
	}
	this.revLayout = rev;
}

// in order for text-mapper to remember the state of shift key, simply pass all key events to
// this method, it does nothing but keeping internal shift state up to date.
TextMapper.prototype.processEvent = function(ev) {
	if (ev.type != EV_KEY)
		return;
	if (ev.code == KEY_LEFTSHIFT)
		this.leftShift = (ev.value != 0 ? true : false);
	if (ev.code == KEY_RIGHTSHIFT)
		this.rightShift = (ev.value != 0 ? true : false);
}

TextMapper.prototype.isShift = function(ev) {
	return this.leftShift || this.rightShift;
}

// AFTER you have passed the event to processEvent, you can
// obtain the character this event would normally generate.
// If the passed event is not a key event, or the code does not match any character
// this method will return null.
// NOTE: it will also return the character for keyUp events
// NOTE: the returned character will be affected by the internal shift state.
TextMapper.prototype.charForEvent = function(ev) {
	if (ev.type != EV_KEY)
		return null;
	var ret;
	if (this.isShift())
		ret = this.revLayout[SHIFT + '-' + ev.code];
	else
		ret = this.revLayout[ev.code.toString()];
	if (typeof(ret) == 'undefined')
		return null;
	else
		return ret;
	return ret;
}

// emits the sequence of key events that generate input of the given text:
TextMapper.prototype.emitText = function(text) {
	for (var i = 0; i < text.length; i++) {
		this.emitChar(text.charAt(i));
	}
}

TextMapper.prototype.emitChar = function(char) {
	var val = this.layout[char];
	if (typeof(val) == 'object') { // array
		this.emitKeyCombination(val);
	} else {
		this.emitKeyCombination([val]);
	}
}

// TODO: what if shift is pressed during emitText?
TextMapper.prototype.emitKeyCombination = function(keys) {
	var i;
	for (i = 0; i < keys.length; i++) {
		emit(EV_KEY, this.translateCode(keys[i]), 1);
	}
	for (i = keys.length - 1; i >= 0; i--) {
		emit(EV_KEY, this.translateCode(keys[i]), 0);
	}
}

TextMapper.prototype.translateCode = function(code) {
	if (code == SHIFT)
		return KEY_LEFTSHIFT;
	else
		return code;
}

