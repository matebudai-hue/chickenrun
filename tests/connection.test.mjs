import test from "node:test";
import assert from "node:assert/strict";

globalThis.location = { hostname: "localhost", origin: "https://example.test" };
const { command, readState } = await import("../docs/connection.js");

test("a lost command response triggers one retry with the identical payload and credentials", async t => {
  const calls = [];
  t.mock.method(globalThis,"fetch",async (url, options) => {
    calls.push({url,body:options.body,token:options.headers.Authorization});
    if (calls.length === 1) throw new DOMException("signal timed out","TimeoutError");
    return Response.json({queued:true});
  });
  let retry = 0;
  const body = {number:1};
  assert.deepEqual(await command("/api/rooms/ABCDEFGH/requeue","fake-key",body,()=>retry++),{queued:true});
  assert.equal(retry,1);
  assert.deepEqual(calls,[calls[0],calls[0]]);
});

test("raw browser timeout text never escapes transport and permanent errors are not retried", async t => {
  t.mock.method(globalThis,"fetch",async () => { throw new DOMException("signal timed out","TimeoutError"); });
  await assert.rejects(readState("/state","key"),{message:"A játékszerver nem válaszolt időben."});
  const errorFetch = t.mock.method(globalThis,"fetch",async () => Response.json({error:"A szoba megtelt."},{status:409}));
  await assert.rejects(command("/join","key",{}),{message:"A szoba megtelt.",retryable:false});
  assert.equal(errorFetch.mock.callCount(),1);
});