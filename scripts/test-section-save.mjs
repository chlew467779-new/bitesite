/**
 * D2-B section save state machine (lib/section-save.mjs): behaviour tests. These are the rules the
 * Merchant and Admin section editors rely on to never lose typing or silently overwrite changes.
 */
import assert from "node:assert/strict";
import {
  applyConflict,
  applyFailure,
  applySaved,
  buildSave,
  canSave,
  createSection,
  dirtyPaths,
  editField,
  keepCurrent,
  sameValue,
  startSave,
  acceptMine,
} from "../lib/section-save.mjs";

const ex = (value) => ({ exists: true, value });
const ABSENT = { exists: false };

/* structural equality */
assert.ok(sameValue({ address: "a", area: null, latitude: 0, longitude: 0 }, { address: "a", area: null, latitude: 0, longitude: 0 }));
assert.ok(!sameValue({ latitude: 0 }, { latitude: null }), "0 is not empty");
assert.ok(sameValue(["Cafe", "Bakery"], ["Cafe", "Bakery"]) && !sameValue(["Cafe"], ["Cafe", "Bakery"]));
assert.ok(!sameValue("", null), "empty string and null differ");

/* create + dirty: untouched paths never dirty, absent hours equal null draft */
let s = createSection(["profile.phone", "profile.email", "hours.mon"], { "profile.phone": ex("+60111"), "profile.email": ex(null), "hours.mon": ABSENT });
assert.deepEqual(dirtyPaths(s), [], "fresh section is clean");
assert.equal(buildSave(s, "r0"), null, "nothing to send");
assert.equal(canSave(s), false);

/* only dirty paths are sent, with the baseline as expected */
s = editField(s, "profile.phone", "+60222");
const save1 = buildSave(s, "r1");
assert.deepEqual(save1.body.patches, [{ path: "profile.phone", expected: ex("+60111"), value: "+60222" }], "only the dirty path, expected = baseline");
s = startSave(s, save1);
assert.equal(canSave(s), false, "one request in flight per section");

/* typing continues during the save: the reply must not overwrite it */
s = editField(s, "profile.phone", "+60333");
s = applySaved(s, save1, { "profile.phone": ex("+60222") });
assert.deepEqual(s.baseline["profile.phone"], ex("+60222"), "baseline advances to what the server confirmed");
assert.equal(s.draft["profile.phone"], "+60333", "later typing is kept");
assert.deepEqual(dirtyPaths(s), ["profile.phone"], "…and still dirty");
const save2 = buildSave(s, "r2");
assert.deepEqual(save2.body.patches[0].expected, ex("+60222"), "next save expects the confirmed value");

/* untouched-since-send path adopts the server's normalized value */
let t = createSection(["profile.tagline"], { "profile.tagline": ex("A") });
t = editField(t, "profile.tagline", "  B  ");
const tSave = buildSave(t, "t1");
t = applySaved(startSave(t, tSave), tSave, { "profile.tagline": ex("B") });
assert.equal(t.draft["profile.tagline"], "B", "draft follows the confirmed normalized value");
assert.deepEqual(dirtyPaths(t), []);

/* a reply without a confirmed value leaves the path dirty (no guessing) */
let u = editField(createSection(["profile.tagline"], { "profile.tagline": ex("A") }), "profile.tagline", "B");
const uSave = buildSave(u, "u1");
u = applySaved(startSave(u, uSave), uSave, {});
assert.deepEqual(dirtyPaths(u), ["profile.tagline"], "unconfirmed path stays dirty");

/* conflict: nothing written locally, drafts kept, section cannot save until resolved */
let c = createSection(["profile.phone", "profile.whatsapp"], { "profile.phone": ex("1"), "profile.whatsapp": ex("W") });
c = editField(editField(c, "profile.phone", "2"), "profile.whatsapp", "W2");
const cSave = buildSave(c, "c1");
c = startSave(c, cSave);
c = editField(c, "profile.phone", "2b"); // typed after sending
c = applyConflict(c, cSave, [{ path: "profile.phone", expected: ex("1"), current: ex("9"), proposed: "2" }]);
assert.equal(c.draft["profile.phone"], "2b", "conflict does not replace the newest draft with the old proposal");
assert.equal(c.draft["profile.whatsapp"], "W2", "the other field's edit stays");
assert.deepEqual(c.baseline["profile.whatsapp"], ex("W"), "non-conflicting field keeps its original expected");
assert.equal(canSave(c), false, "resolve conflicts first");

/* use mine: expected becomes the shown current value, draft kept, then a new request */
let mine = acceptMine(c, "profile.phone");
assert.equal(canSave(mine), true);
const mineSave = buildSave(mine, "c2");
assert.deepEqual(mineSave.body.patches.find((p) => p.path === "profile.phone"), { path: "profile.phone", expected: ex("9"), value: "2b" });
assert.deepEqual(mineSave.body.patches.find((p) => p.path === "profile.whatsapp").expected, ex("W"), "whatsapp still expects its original baseline");
assert.notEqual(mineSave.requestId, cSave.requestId);

/* keep current: baseline and draft become the server value, field clean, others kept */
let keep = keepCurrent(c, "profile.phone");
assert.equal(keep.draft["profile.phone"], "9");
assert.deepEqual(dirtyPaths(keep), ["profile.whatsapp"]);
assert.equal(canSave(keep), true);

/* keep current on everything with nothing else dirty: no request needed */
let only = editField(createSection(["profile.email"], { "profile.email": ex("a@b.co") }), "profile.email", "c@d.co");
const onlySave = buildSave(only, "o1");
only = keepCurrent(applyConflict(startSave(only, onlySave), onlySave, [{ path: "profile.email", current: ex("x@y.co"), proposed: "c@d.co" }]), "profile.email");
assert.equal(buildSave(only, "o2"), null, "nothing left to send");

/* failures keep everything */
let f = editField(createSection(["profile.tagline"], { "profile.tagline": ex("A") }), "profile.tagline", "B");
const fSave = buildSave(f, "f1");
f = applyFailure(startSave(f, fSave), { code: "VALIDATION_FAILED", fieldErrors: { "profile.tagline": "bad" } });
assert.equal(f.draft["profile.tagline"], "B");
assert.equal(f.pending, null);
f = editField(f, "profile.tagline", "C");
assert.equal(f.error.fieldErrors["profile.tagline"], undefined, "editing a field clears its error");

/* hours: absent vs value; removing a day is null */
let h = createSection(["hours.mon"], { "hours.mon": ex("09:00 - 17:00") });
h = editField(h, "hours.mon", null);
assert.deepEqual(buildSave(h, "h1").body.patches, [{ path: "hours.mon", expected: ex("09:00 - 17:00"), value: null }]);
const hSave = buildSave(h, "h1");
h = applySaved(startSave(h, hSave), hSave, { "hours.mon": ABSENT });
assert.deepEqual(dirtyPaths(h), [], "removed day is clean after confirmation");

/* the save snapshot is immutable */
assert.throws(() => { save1.sent["profile.phone"].value = "x"; }, TypeError);

console.log("section save checks passed");
