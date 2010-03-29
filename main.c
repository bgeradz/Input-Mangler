#include <stdio.h>
#include <string.h>
#include <errno.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <getopt.h>

#include <sys/time.h> 
#include <sys/types.h> 
#include <sys/ioctl.h> 

#include <linux/input.h>
#include <linux/uinput.h>

// this is for timer pseudo event
#define EV_TIMER 0x20

#include "scripting.h"

#define MAX_INPUTS 20
#define MAX_INCLUDE_PATHS 20

int input_fds[MAX_INPUTS];
int input_count = 0;
int uinput_fd = -1;


struct input_event ev;
struct uinput_user_dev dev;

char* include_paths[MAX_INCLUDE_PATHS + 1] = {0};
int include_path_count = 0;

// in usec
#define TIMER_INTERVAL (1000000 / 100) // 1/100 sec.

void emitEvent(int type, int code, int value) {
	ev.type = type;
	ev.code = code;
	ev.value = value;
	/*
	printf("EMIT: type: %d  code: %d  value: %d\n",
		ev.type, ev.code, ev.value);
	*/
	write(uinput_fd, &ev, sizeof(ev));
}

int rescue_keys[] = {
	KEY_RIGHTSHIFT,
	KEY_RIGHTCTRL,
};
#define rescue_len (sizeof(rescue_keys) / sizeof(int))

void init_uinput(char *file) {
	int i;

	// preparing uinput device
	uinput_fd = open(file, O_WRONLY | O_NDELAY);
	if (uinput_fd < 0)
	{
		fprintf(stderr, "could not open uinput device %s: %s\n", file, strerror(errno));
		exit(2);
	}

	sprintf(dev.name, "input-mangler");
	write(uinput_fd, &dev, sizeof(dev));

	/* keyboard stuff */
	if (ioctl(uinput_fd, UI_SET_EVBIT, EV_KEY) < 0)
	{
		fprintf(stderr, "error at line %d: %s\n",
		__LINE__, strerror(errno));
	}
	if (ioctl(uinput_fd, UI_SET_EVBIT, EV_REP) < 0)
	{
		fprintf(stderr, "error at line %d: %s\n",
		__LINE__, strerror(errno));
	
	}
	if (ioctl(uinput_fd, UI_SET_EVBIT, EV_SYN) < 0)
	{
		fprintf(stderr, "error at line %d: %s\n",
		__LINE__, strerror(errno));
	
	}
	for (i = 1; i < KEY_UNKNOWN; i++)
	{
		if (ioctl(uinput_fd, UI_SET_KEYBIT, i) < 0)
		{
			fprintf(stderr, "error registering key %d at line %d: %s\n",
			i, __LINE__, strerror(errno));
		}
	}

	/* mouse stuff */
	if (ioctl(uinput_fd, UI_SET_EVBIT, EV_REL) < 0)
	{
		fprintf(stderr, "error at line %d: %s\n",
		__LINE__, strerror(errno));
	}
	for (i = REL_X; i < REL_MAX; i++)
	{
		if (ioctl(uinput_fd, UI_SET_RELBIT, i) < 0)
		{
			fprintf(stderr, "error registering REL %d at line %d: %s\n",
			i, __LINE__, strerror(errno));
		}
	}
	for (i = BTN_MOUSE; i < BTN_TASK; i++)
	{
		if (ioctl(uinput_fd, UI_SET_KEYBIT, i) < 0)
		{
			fprintf(stderr, "error registering BTN %d at line %d: %s\n",
			i, __LINE__, strerror(errno));
		}
	}

	/* *********** */
	if (ioctl(uinput_fd, UI_DEV_CREATE, 0) < 0)
	{
		fprintf(stderr, "error at line %d: %s\n",
		__LINE__, strerror(errno));
	}

}
void usage() {
	fprintf(stderr, "Usage: kbd-mangler [options] <script>\n");
	fprintf(stderr, "Options:\n");
	fprintf(stderr, "  -I path: add include path for use by include() JS function (multiple allowed)\n");
	fprintf(stderr, "  -r device file: read given input device (multiple allowed)\n");
	fprintf(stderr, "  -w device file: write to the given uinput device (mandatory option)\n");

	exit(1);
}

static struct option long_options[] = {
	{"read", 1, 0, 'r'},
	{"write", 1, 0, 'w'},
	{0, 0, 0, 0}
};

void main_loop() {
	int interrupt = 0;
	int i;
	int res;
	int rescue_state[rescue_len];
	fd_set read_fds;
	int nfds = -1;

	struct timeval timeout;

	// initializing rescue state
	for (i = 0; i < rescue_len; i++)
		rescue_state[i] = 0;

	// calculating nfds
	for (i = 0; i < input_count; i++)
		if (input_fds[i] > nfds)
			nfds = input_fds[i];
	nfds++;

	while (! interrupt)
	{
		char *ptr = (char *)&ev;

		timeout.tv_sec = 0;
		timeout.tv_usec = TIMER_INTERVAL;

		FD_ZERO(&read_fds);
		for (i = 0; i < input_count; i++) {
		    FD_SET(input_fds[i], &read_fds);
		}

		res = select(nfds, &read_fds, NULL, NULL, &timeout);
	
		if (res == -1) {
			fprintf(stderr, "select() failed: %s\n", strerror(errno));
			exit(1);
		}

		if (res == 0) {
			// TODO: maybe pass womething usefull in code/value
			ProcessEvent(EV_TIMER, ev.code, ev.value);
			continue;	
		}

		for (i = 0; i < input_count; i++) {
			if (FD_ISSET(input_fds[i], &read_fds)) {
				res = read(input_fds[i], ptr, sizeof(ev));
				if (res > 0) {
					// checking rescue sequence.
					if (ev.type == EV_KEY) {
						int all = 1;
						for (i = 0; i < rescue_len; i++) {
							if (rescue_keys[i] == ev.code)
								rescue_state[i] = (ev.value == 0 ? 0 : 1);
							all = all && rescue_state[i];
						}
						if (all)
							interrupt = 1;
					}

					// printf("type: %d  code: %d  value: %d\n", ev.type, ev.code, ev.value);
					ProcessEvent(ev.type, ev.code, ev.value);
				}
			}
		}
	}
}

void add_include_path(char *path) {
	if (include_path_count < MAX_INCLUDE_PATHS) {
		include_paths[include_path_count++] = strdup(path);
		include_paths[include_path_count] = NULL;
	} else {
		fprintf (stderr, "Maximum number of include paths exceeded (%d)\n", MAX_INCLUDE_PATHS);
		exit(1);
	}
}

int main(int argc, char **argv)
{
	int i;
	int res;
	int one = 1;
	int option_index = 0;
	int c;

	char *main_script = NULL;

	// adding default include paths
	add_include_path(".");
	// TODO: once ordinary installation is available, add /usr/share/kbd-mangler/js or something

	while (1) {
		c = getopt_long(argc, argv, "r:w:I:", long_options, &option_index);
		if (c == -1)
			break;
		switch (c) {
			case 'r': {
				// preparing input device
				int input_fd = open(optarg, O_RDONLY);
				if (input_fd < 0)
				{
					fprintf(stderr, "could not open input device %s: %s\n", optarg, strerror(errno));
					exit(2);
				}
				if (ioctl(input_fd, EVIOCGRAB, (void *)1) < 0)
				{
					fprintf (stderr, "unable to grab device '%s' : %s\n", optarg, strerror(errno));
				}
				if (ioctl(input_fd, FIONBIO, (void *)&one) < 0)
				{
					fprintf (stderr, "unable to set device '%s' to non-blocking mode : %s\n", optarg, strerror(errno));
				}
				if (input_count < MAX_INPUTS) {
					input_fds[input_count++] = input_fd;
				} else {
					fprintf (stderr, "Maximum number of input devices exceeded (%d)\n", MAX_INPUTS);
					exit(1);
				}
				break;
			}

			case 'w':
				if (uinput_fd >= 0) {
					fprintf(stderr, "multiple -w options are not allowed\n");
					usage();
					exit(1);
				}
				init_uinput(optarg);
				break;

			case 'I':
				add_include_path(optarg);
				break;	

			case '?':
				break;
			default:
				fprintf(stderr, "getopt returned unexpectd char code: 0%o\n", c);
				exit(1);
		}
	}

	if (uinput_fd == -1) {
		usage();
	}

	// script name left
	if (argc - optind  != 1)
		usage();

	res = InitScripting(argv[optind]); // custom main script

	if (res) {
		main_loop();
	} else {
		fprintf(stderr, "Error initializing scripting\n");
	}

	DestroyScripting();

	for (i = 0; i < input_count; i++)
		close(input_fds[i]);
	close(uinput_fd);
}

