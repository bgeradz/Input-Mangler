// trivial mangler that emits all events back without modification and prints the events to stdout.

include('keysyms.js');
include('keynames.js');
include('layouts/US.js');
include('utils/TextMapper.js');

// configuration
var abbrevs = {
	'rtfm': 'please read the manual',
	'dnd': 'drag and drop',
	'qa': 'quality assurance',
	'QA': 'Quality Assurance',

 	// that's very strange, but for some reason the below sometimes expands to "rotflng". Absolutely no clue :-(
	'rotfl': 'rolling on the floor laughing',
	// and the below works OK. What's the magic about "rolling"???
	'rofl': 'roll on the floor laughing'
	// and the most funny thing about rotfl - it works wrong only in my X terminal, but is OK in console.
}

// regular expression covering all characters that are allowed in abbreviations.
var abbrRegex = /[a-zA-Z0-9]/;

mapper = new TextMapper(layout_US);
var buffer = '';


// should return true if the given event or character should reset the abbreviation buffer
function isTerminator(code, char) {
	switch (code) {
		case KEY_LEFTSHIFT:
		case KEY_RIGHTSHIFT:
			return false;
	}

	if (char === null)
		return true;

	return ! abbrRegex.test(char);
}

// should return true, if the event/char should trigger abbreviation expansion
function expandNow(code, char) {
	switch (code) {
		case KEY_ENTER:
			return true;
	}
	if (char === null)
		return false;
	return ! abbrRegex.test(char);
}

function process(ev) {
	if (ev.type == EV_KEY) {
		// log('EVENT '+ ev.code+ ' '+sym(ev.code) +' '+ ev.value);
		mapper.processEvent(ev);
		var char = mapper.charForEvent(ev);

		if (ev.value && expandNow(ev.code, char)) {
			var expansion = abbrevs[buffer];
			if (expansion) {
				// backspacing the abbreviation:
				log('backspacing '+buffer.length+' chars');
				for (var i = 0; i < buffer.length; i++) {
					emit(EV_KEY, KEY_BACKSPACE, 1);	
					emit(EV_KEY, KEY_BACKSPACE, 0);
				}
				log("expanding to: "+ expansion);
				mapper.emitText(expansion);
			} else {
				log("no expansion for: "+ buffer);
			}
			buffer = ''; // resetting buffer
		}

		if (isTerminator(ev.code, char)) {
			buffer = '';
		} else {
			if (ev.value && char !== null)
				buffer += char;
		}
		if (ev.value)
			log("BUFFER: "+ buffer);
	}
	emit(ev.type, ev.code, ev.value);
}

