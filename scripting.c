#include <jsapi.h>

#include <sys/types.h>
#include <sys/stat.h>
#include <unistd.h>
#include <malloc.h>
#include <string.h>
#include <errno.h>
#include <sys/time.h>
#include <time.h>
#include <math.h>

// #include "log.h"

#define logit(args) { \
	printf args; \
	printf("\n"); \
}
#define logit_(args) { \
	printf args; \
}


#define log_begin()
#define log_end()

#include "scripting.h"

/*
 * Tune this to avoid wasting space for shallow stacks, while saving on
 * malloc overhead/fragmentation for deep or highly-variable stacks.
 */
#define STACK_CHUNK_SIZE    8192

extern char* include_paths[];

static JSRuntime *rt = NULL;
static JSContext *cx = NULL;
static JSObject *glob = NULL;
// static JSScript *script = NULL;

static char *read_script(const char *filename);
static BOOL evaluate_source(char *filename, char *source, uintN lineNumber);

void emitEvent(int type, int code, int value);

static void setIntProperty(JSObject *obj, const char *name, int value)
{
    jsval val;
    if (!JS_NewNumberValue(cx, (jsdouble)value, &val))
        return;
    if (!JS_SetProperty(cx, obj, name, &val))
        return;
}



/* Native function implementations */

static JSBool
js_abs(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
	jsdouble x, z;

	if (!JS_ValueToNumber(cx, argv[0], &x))
		return JS_FALSE;
	z = (x < 0) ? -x : x;
	return JS_NewDoubleValue(cx, z, rval);
}

static JSBool
js_floor(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
	jsdouble x, z;

	if (!JS_ValueToNumber(cx, argv[0], &x))
		return JS_FALSE;
	z = floor(x);
	return JS_NewDoubleValue(cx, z, rval);
}

static JSBool
js_ceil(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
	jsdouble x, z;

	if (!JS_ValueToNumber(cx, argv[0], &x))
		return JS_FALSE;
	z = ceil(x);
	return JS_NewDoubleValue(cx, z, rval);
}

static JSBool
js_time(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
	jsdouble millis;
	long long lm;
	struct timeval tv;
	gettimeofday(&tv, NULL);
	
	millis = (long long)tv.tv_sec * 1000 + tv.tv_usec / 1000;
	
	return JS_NewDoubleValue(cx, millis, rval);
}

static JSBool
js_log(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSString *str;

    str = JS_ValueToString(cx, argv[0]);
    if (!str)
		return JS_FALSE;
    logit(("%s", JS_GetStringBytes(str)));

    return JS_TRUE;
}

static JSBool
js_emit(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
	int32 type;
	int32 code;
	int32 value;

    if (!JS_ValueToInt32(cx, argv[0], &type))
	{
		logit(("invalid argument 1 to emit()"));
		return JS_TRUE;
	}
    if (!JS_ValueToInt32(cx, argv[1], &code))
	{
		logit(("invalid argument 2 to emit()"));
		return JS_TRUE;
	}
    if (!JS_ValueToInt32(cx, argv[2], &value))
	{
		logit(("invalid argument 3 to emit()"));
		return JS_TRUE;
	}
	emitEvent(type, code, value);
    return JS_TRUE;
}

static JSBool
js_include(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSString *str;
	char filename[1024];
	char *incl;
	char *script;
	JSBool res;

	char **path;


    str = JS_ValueToString(cx, argv[0]);
    if (!str)
	{
		logit(("invalid argument to include()"));
		return JS_FALSE;
	}

	incl = JS_GetStringBytes(str);
	for (path = include_paths; *path; path++) {
		sprintf(filename, "%s/%s", *path, incl);
		script = read_script(filename);
		if (script) {
			res = evaluate_source(filename, script, 1);
			free(script);
			return res;
		}
	}
	logit(("%s not found in include paths", incl));
	return JS_FALSE;
}

static JSBool
js_exec(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSString *str;
	JSBool res;

	char *command;

	pid_t child_pid;

    str = JS_ValueToString(cx, argv[0]);
    if (!str)
	{
		logit(("invalid argument to exec()"));
		return JS_FALSE;
	}

	command = JS_GetStringBytes(str);

	child_pid = fork();
	if (child_pid == -1) {
		logit(("fork() failed"));
		return JS_FALSE;
	}
	if (child_pid > 0) { // parent process
		int status;
		pid_t pid = waitpid(child_pid, &status, 0);
		if (pid == -1) {
			logit(("waitpid failed"));
			return JS_FALSE;
		} else {
			return JS_NewDoubleValue(cx, (double)status, rval);
		}
	} else { // child process
		char *comargv[4];
		comargv[0] = "sh";
		comargv[1] = "-c";
		comargv[2] = command;
		comargv[3] = NULL;
		execvp("sh", comargv);
		logit(("execvp() failed: %s", strerror(errno)));
		return JS_FALSE;
	}

	return JS_FALSE;
}

/* The class of the global object. */
static JSClass global_class = {
    "global", JSCLASS_GLOBAL_FLAGS,
    JS_PropertyStub, JS_PropertyStub, JS_PropertyStub, JS_PropertyStub,
    JS_EnumerateStub, JS_ResolveStub, JS_ConvertStub, JS_FinalizeStub,
    JSCLASS_NO_OPTIONAL_MEMBERS
};



static BOOL evaluate_source(char *filename, char *source, uintN lineNumber)
{
    jsval rval;
    JSBool ok;

    ok = JS_EvaluateScript(cx, glob, source, strlen(source),
                           filename, lineNumber, &rval);
	return ok;
}

static char *read_script(const char *filename)
{
	int res;
	struct stat buf;
	int size;
	char *buffer;
	int buffer_offset;
	FILE *f;

	if (stat(filename, &buf))
	{
		// logit(("Unable to stat file: %s", filename));
		return NULL;
	}
	size = (int)buf.st_size;
	buffer = (char *)malloc((size + 1) * sizeof(char));
	if (! buffer)
	{
		logit(("Unable to malloc %d bytes", size));
		return NULL;
	}

	f = fopen(filename, "rb");
	if (! f)
	{
		free(buffer);
		logit(("Unable to open file for reading: %s", filename));
		return NULL;
	}

	buffer_offset = 0;
	while (! feof(f) && ! ferror(f) && buffer_offset < size)
	{
		res = fread(buffer + buffer_offset, 1, size - buffer_offset, f);
		buffer_offset += res;
	}
	fclose(f);

	buffer[buffer_offset] = 0;

	return buffer;
}

static void
js_error_reporter(JSContext *cx, const char *message, JSErrorReport *report)
{
    int n;
    const char *ctmp;

	if (!report)
	{
		logit(("%s", message));
		return;
	}

	log_begin();

	if (report->filename)
	{
		logit_(("%s", (char *)report->filename));
		logit_((":"));
	}
	if (report->lineno)
	{
		logit_(("%d", (int)report->lineno));
		logit_((": "));
	}
	if (JSREPORT_IS_WARNING(report->flags))
	{
		if (JSREPORT_IS_STRICT(report->flags))
			logit(("(STRICT WARN)"))
		else
			logit(("(WARN)"))
	}

	logit(("%s", message));
	if (report->linebuf)
		logit(("\n%s", report->linebuf));

	log_end();
}


BOOL InitScripting(char *main_script_path)
{
	char *src;
	JSBool res;

	/* You need a runtime and one or more contexts to do anything with JS. */
	rt = JS_NewRuntime(8 * 1024 * 1024);
	if (!rt)
	{
		logit(("can't create JavaScript runtime"));
		return FALSE;
	}
	cx = JS_NewContext(rt, STACK_CHUNK_SIZE);
	if (!cx)
	{
		logit(("can't create JavaScript context"));
		return FALSE;
	}
    JS_SetOptions(cx, JSOPTION_VAROBJFIX);
    // JS_SetVersion(cx, JSVERSION_LATEST);

    JS_SetErrorReporter(cx, js_error_reporter);

	glob = JS_NewObject(cx, &global_class, NULL, NULL);
	if (! glob) {
		logit(("error instantiating global object"));
		return FALSE;
	}

	if (!JS_InitStandardClasses(cx, glob)) {
		logit(("error initializing standard classes"));
		return FALSE;
	}

	/* Does not work with new spidermonkey for some F@@#$ reason
	if (!JS_DefineFunctions(cx, glob, native_functions)) {
		logit(("error defining native functions"));
		return FALSE;
	}
	*/
	JS_DefineFunction(cx, glob, "include",	js_include, 1, 0);
	JS_DefineFunction(cx, glob, "abs",	js_abs, 1, 0);
	JS_DefineFunction(cx, glob, "floor",	js_floor, 1, 0);
	JS_DefineFunction(cx, glob, "ceil",	js_ceil, 1, 0);
	JS_DefineFunction(cx, glob, "time",	js_time, 1, 0);
	JS_DefineFunction(cx, glob, "log",	js_log, 1, 0);
	JS_DefineFunction(cx, glob, "emit",	js_emit, 1, 0);
	JS_DefineFunction(cx, glob, "exec",	js_exec, 1, 0);

	/*
	{
		// assigning "glob"
		if (!JS_SetProperty(cx, glob, "glob", OBJECT_TO_JSVAL(glob))) {
			logit(("can't assign 'glob' object"));
			return FALSE;
		}
	}
	*/

	
	src = read_script(main_script_path);
	if (src)
	{
		res = evaluate_source(main_script_path, src, 1);
		free(src);
	}
	return res;
}

BOOL DestroyScripting()
{
//    if (script)
//        JS_DestroyScript(cx, script);
    if (cx)
		JS_DestroyContext(cx);
	if (rt)
		JS_DestroyRuntime(rt);

	return TRUE;
}

BOOL ProcessEvent(int type, int code, int value)
{
	JSObject *obj;

	jsval argv[1];
	JSBool boolVal;
	jsval rval;
	JSBool ok;

	obj = JS_NewObject(cx, NULL, NULL, NULL /*glob*/);

	setIntProperty(obj, "type", type);
	setIntProperty(obj, "code", code);
	setIntProperty(obj, "value", value);

	argv[0] = OBJECT_TO_JSVAL(obj);
	ok = JS_CallFunctionName(cx, glob, "process", 1, argv, &rval);

	if (! ok)
		return FALSE;

	if (!JS_ValueToBoolean(cx, rval, &boolVal))
        	return FALSE;

	return (boolVal ? TRUE : FALSE);
}


