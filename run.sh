#!/bin/sh

# run this script as root or someone having access to /dev/input/*

# If /dev/uinput or /dev/input/uinput device file is not present issue:
# $ modprobe uinput

# You must find your keyboard event device file instead of /dev/input/event3
# Do so by issuing:
# $ cat /dev/input/event*
# for every event device file until you find the one that outputs garbage to the terminal
# in response to your typing

KBD_DEV=/dev/input/event3

# may also be /dev/input/uinput
UINPUT_DEV=/dev/uinput


sleep 1 # against initial ENTER key hanging when starting this script from shell

echo Starting kbd-mangler...

# need this if your spidermonkey library resides in some obscure place (as in my case on ubuntu)
export LD_LIBRARY_PATH=/usr/lib/xulrunner-devel-1.9.1.8/sdk/lib

./kbd-mangler $KBD_DEV $UINPUT_DEV $@

