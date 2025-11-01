import { describe, it } from "node:test";
import { z } from "zod";
import { StateMachine } from "./index.js";
import { expect } from "expect";

// Tests for the StateMachine
describe("FSM", () => {
  it("should process promise", async () => {
    const machine = new StateMachine();

    const promiseState = machine
      .state("promise", {
        schema: z.object({ val: z.number() }),
      })
      .initWithPromise(
        async (data) => {
          if (data.val >= 100) {
            throw new Error("test error");
          }
          return promiseState.build({
            val: data.val + 10,
          });
        },
        (data, err) =>
          anotherPromiseState.build({
            abc: data.val,
            err,
          }),
      );

    const anotherPromiseState = machine
      .state("another_promise", {
        schema: z.object({
          abc: z.number(),
          err: z.any().optional(),
        }),
      })
      .initWithPromise(async (data) => {
        if (data.abc >= 110) {
          throw new Error("another test error");
        }
        return anotherPromiseState.build({
          abc: data.abc + 10,
        });
      });

    // flow
    let state = machine.parse({
      $name: "promise",
      $data: {
        val: 90,
      },
    });

    expect(state).not.toBeNull();
    expect(state!.name).toBe("promise");
    expect(state!.type).toBe("PROMISE");
    expect(state!.data).toStrictEqual({ val: 90 });
    expect(state!.result).toBeNull();
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "promise", $data: { val: 90 } });

    state = state!.emit("abcd", undefined);

    expect(state).not.toBeNull();
    expect(state!.name).toBe("promise");
    expect(state!.type).toBe("PROMISE");
    expect(state!.data).toStrictEqual({ val: 90 });
    expect(state!.result).toBeNull();
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "promise", $data: { val: 90 } });

    state = await state.exec();

    expect(state).not.toBeNull();
    expect(state!.name).toBe("promise");
    expect(state!.type).toBe("PROMISE");
    expect(state!.data).toStrictEqual({ val: 100 });
    expect(state!.result).toBeNull();
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "promise", $data: { val: 100 } });

    state = await state.exec();

    expect(state).not.toBeNull();
    expect(state!.name).toBe("another_promise");
    expect(state!.type).toBe("PROMISE");
    expect(state!.data).toMatchObject({ abc: 100 });
    expect((state!.data as any).err.message).toEqual("test error");
    expect(state!.result).toBeNull();
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toMatchObject({ $name: "another_promise", $data: { abc: 100 } });
    expect((state!.export().$data as any).err.message).toEqual("test error");

    state = await state.exec();

    expect(state).not.toBeNull();
    expect(state!.name).toBe("another_promise");
    expect(state!.type).toBe("PROMISE");
    expect(state!.data).toStrictEqual({ abc: 110 });
    expect(state!.data).not.toHaveProperty("err");
    expect(state!.result).toBeNull();
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "another_promise", $data: { abc: 110 } });
    expect(state!.export().$data).not.toHaveProperty("err");

    state = await state.exec();

    expect(state).not.toBeNull();
    expect(state!.name).toBe("another_promise");
    expect(state!.type).toBe("PROMISE");
    expect(state!.data).toStrictEqual({ abc: 110 });
    expect(state!.data).not.toHaveProperty("err");
    expect(state!.result).toBeNull();
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "another_promise", $data: { abc: 110 } });
    expect(state!.data).not.toHaveProperty("err");
  });

  it("should process event", async () => {
    const machine = new StateMachine();

    const addEvent = machine.event("add", z.object({ add: z.number() }));
    const eventState = machine
      .state("event", {
        schema: z.object({ val: z.number() }),
      })
      .initWithEvents([
        addEvent.handler((data, arg) => {
          return eventState.build({
            val: data.val + arg.add,
          });
        }),
      ]);

    // flow
    let state = machine.parse({
      $name: "event",
      $data: {
        val: 10,
      },
    });

    expect(state).not.toBeNull();
    expect(state!.name).toBe("event");
    expect(state!.type).toBe("EVENTS");
    expect(state!.data).toStrictEqual({ val: 10 });
    expect(state!.result).toBeNull();
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "event", $data: { val: 10 } });

    state = await state!.exec();

    expect(state).not.toBeNull();
    expect(state!.name).toBe("event");
    expect(state!.type).toBe("EVENTS");
    expect(state!.data).toStrictEqual({ val: 10 });
    expect(state!.result).toBeNull();
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "event", $data: { val: 10 } });

    state = state.emit("add", { add: 20 });

    expect(state).not.toBeNull();
    expect(state!.name).toBe("event");
    expect(state!.type).toBe("EVENTS");
    expect(state!.data).toStrictEqual({ val: 30 });
    expect(state!.result).toBeNull();
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "event", $data: { val: 30 } });

    state = state.emit("invalid", { add: 20 });

    expect(state).not.toBeNull();
    expect(state!.name).toBe("event");
    expect(state!.type).toBe("EVENTS");
    expect(state!.data).toStrictEqual({ val: 30 });
    expect(state!.result).toBeNull();
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "event", $data: { val: 30 } });

    expect(() => {
      state = state!.emit("add", { add: "invalid" });
    }).toThrow(
      '[\n  {\n    "code": "invalid_type",\n    "expected": "number",\n    "received": "string",\n    "path": [\n      "add"\n    ],\n    "message": "Expected number, received string"\n  }\n]',
    );

    expect(state).not.toBeNull();
    expect(state!.name).toBe("event");
    expect(state!.type).toBe("EVENTS");
    expect(state!.data).toStrictEqual({ val: 30 });
    expect(state!.result).toBeNull();
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "event", $data: { val: 30 } });

    // TODO некрасиво. лучше требовать всегда создавать event, чем вот это вот
    const e = addEvent.build({ add: 10 });
    state = state.emit(e.name, e.arg);

    expect(state).not.toBeNull();
    expect(state!.name).toBe("event");
    expect(state!.type).toBe("EVENTS");
    expect(state!.data).toStrictEqual({ val: 40 });
    expect(state!.result).toBeNull();
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "event", $data: { val: 40 } });
  });

  it("should process final", async () => {
    const machine = new StateMachine();

    const finalState = machine
      .state("final", {
        schema: z.object({ val: z.number() }),
      })
      .initAsFinal();

    // flow
    let state = machine.parse({
      $name: "final",
      $data: {
        val: 10,
      },
    });

    expect(state).not.toBeNull();
    expect(state!.name).toBe("final");
    expect(state!.type).toBe("FINAL");
    expect(state!.data).toStrictEqual({ val: 10 });
    expect(state!.result).toStrictEqual({ value: { val: 10 } });
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "final", $data: { val: 10 } });

    state = await state!.exec();

    expect(state).not.toBeNull();
    expect(state!.name).toBe("final");
    expect(state!.type).toBe("FINAL");
    expect(state!.data).toStrictEqual({ val: 10 });
    expect(state!.result).toStrictEqual({ value: { val: 10 } });
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "final", $data: { val: 10 } });

    state = state.emit("add", { add: 20 });

    expect(state).not.toBeNull();
    expect(state!.name).toBe("final");
    expect(state!.type).toBe("FINAL");
    expect(state!.data).toStrictEqual({ val: 10 });
    expect(state!.result).toStrictEqual({ value: { val: 10 } });
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "final", $data: { val: 10 } });
  });

  // TODO не позволять объявлять стейты с одинаковыми именами (даже parent + child)
  // TODO не позволять объявлять event-ы с одинаковыми именами (кроме $-системных, их не сохранять вообще)

  it("should process parent", async () => {
    const machine = new StateMachine();

    const parentState = machine
      .state("parent", {
        schema: z.object({ val: z.number() }),
      })
      .initAsParent();

    const child1 = parentState
      .subState("child1", {
        schema: z.object({ abc: z.number() }),
      })
      .initWithPromise(async (data) => {
        return child2.build({
          $parent: data.$parent,
          $value: {
            xyz: data.$parent.val + data.$value.abc,
          },
        });
      });

    const child2 = parentState
      .subState("child2", {
        schema: z.object({ xyz: z.number() }),
      })
      .initWithPromise(async (data) => {
        throw new Error("test");
      });

    // flow
    // expect(() => {
    //   parentState.build({
    //     val: 123
    //   })
    // }).toThrow('can\'t call build for parent state')

    // expect(() => {
    //   machine.parse({
    //     $name: 'parent',
    //     $data: {
    //       val: 10
    //     }
    //   })
    // }).toThrow('can\'t call build for parent state')

    const parsed = machine.parse({
      $name: "parent",
      $data: {
        val: 10,
      },
    });
    expect(parsed).toBeNull();

    let state = machine.parse({
      $name: "child1",
      $data: {
        $parent: {
          val: 10,
        },
        $value: {
          abc: 20,
        },
      },
    });

    expect(state).not.toBeNull();
    expect(state!.name).toBe("child1");
    expect(state!.type).toBe("PROMISE");
    expect(state!.data).toStrictEqual({ $parent: { val: 10 }, $value: { abc: 20 } });
    expect(state!.result).toBeNull();
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "child1", $data: { $parent: { val: 10 }, $value: { abc: 20 } } });

    state = await state!.exec();

    expect(state).not.toBeNull();
    expect(state!.name).toBe("child2");
    expect(state!.type).toBe("PROMISE");
    expect(state!.data).toStrictEqual({ $parent: { val: 10 }, $value: { xyz: 30 } });
    expect(state!.result).toBeNull();
    expect(state!.info).toStrictEqual(undefined);
    expect(state!.export()).toStrictEqual({ $name: "child2", $data: { $parent: { val: 10 }, $value: { xyz: 30 } } });
  });

  it("should process simple flow", async () => {
    const machine = new StateMachine();

    const promiseState = machine
      .state("promise", {
        schema: z.object({ foo: z.number() }),
      })
      .initWithPromise(
        async (data) => {
          if (data.foo > 100) {
            throw new Error("test error");
          }
          const res = eventState.build({
            bar: data.foo * 2,
          });
          return res;
        },
        (err) =>
          failedState.build({
            err,
          }),
      );

    const failedState = machine
      .state("failed", {
        schema: z.object({
          err: z.any(),
        }),
      })
      .initAsFinal();

    const addEvent = machine.event("add", z.object({ val: z.number() }));
    const div = machine.event("div", z.object({ denominator: z.number() }));
    const finalizeEvent = machine.event("finalize", z.void());

    const eventState = machine
      .state("event", {
        schema: z.object({ bar: z.number() }),
      })
      .initWithEvents([
        machine.event("$init", z.void()).handler((data) => {
          return eventState.build(
            {
              bar: data.bar * 10,
            },
            true,
          );
        }),
        addEvent.handler((data, arg) => {
          return eventState.build({
            bar: data.bar + arg.val,
          });
        }),
        div.handler((data, arg) => {
          return divided.build({
            $parent: {
              denominator: arg.denominator,
            },
            $value: {
              numerator: data.bar,
            },
          });
        }),
      ]);

    const parentState = machine
      .state("parent", {
        schema: z.object({
          denominator: z.number(),
        }),
      })
      .initAsParent();

    const divided = parentState
      .subState("divided", {
        schema: z.object({
          numerator: z.number(),
        }),
      })
      .initWithEvents([
        addEvent.handler((data, arg) => {
          return divided.build({
            $parent: data.$parent,
            $value: {
              numerator: data.$value.numerator + arg.val,
            },
          });
        }),
        finalizeEvent.handler((data) => {
          return finalState.build({
            baz: data.$value.numerator / data.$parent.denominator,
          });
        }),
      ]);

    const finalState = machine
      .state("final", {
        schema: z.object({
          baz: z.number(),
        }),
      })
      .initAsFinal();

    // flow

    let state = machine.parse({
      $name: "promise",
      $data: {
        foo: 10,
      },
    });

    expect(state).not.toBeNull();
    expect(state!.name).toBe("promise");
    expect(state!.data).toStrictEqual({ foo: 10 });

    state = await state!.exec();

    expect(state).not.toBeNull();
    expect(state!.name).toBe("event");
    expect(state!.data).toStrictEqual({ bar: 200 });

    state = state!.emit("add", { val: 10 });

    expect(state).not.toBeNull();
    expect(state!.name).toBe("event");
    expect(state!.data).toStrictEqual({ bar: 2100 });

    state = state!.emit("div", { denominator: 5 });

    expect(state).not.toBeNull();
    expect(state!.name).toBe("divided");
    expect(state!.data).toStrictEqual({ $value: { numerator: 2100 }, $parent: { denominator: 5 } });

    state = state!.emit("add", { val: 5 });

    expect(state).not.toBeNull();
    expect(state!.name).toBe("divided");
    expect(state!.data).toStrictEqual({ $value: { numerator: 2105 }, $parent: { denominator: 5 } });

    state = state!.emit("finalize", undefined);

    expect(state).not.toBeNull();
    expect(state!.name).toBe("final");
    expect(state!.data).toStrictEqual({ baz: 2105 / 5 });
    expect(state!.result).toStrictEqual({ value: { baz: 2105 / 5 } });
  });

  it("should contain info", () => {
    const machine = new StateMachine<{ foo: string; bar: string; baz?: string }>();

    const state1 = machine
      .state("state1", {
        schema: z.object({
          bar: z.string(),
        }),
        info: {
          foo: "foo",
          bar: (data) => data.bar,
        },
      })
      .initAsFinal();

    const parent = machine
      .state("parent", {
        schema: z.object({
          foo: z.string(),
        }),
        info: {
          foo: (data) => data.foo,
          bar: "bar",
        },
      })
      .initAsParent();

    parent
      .subState("child1", {
        schema: z.void(),
      })
      .initAsFinal();

    parent
      .subState("child2", {
        schema: z.object({
          bar: z.string(),
        }),
        info: {
          bar: (data) => data.$value.bar,
        },
      })
      .initAsFinal();

    const parent2 = parent
      .subState("parent2", {
        schema: z.object({
          baz: z.string(),
        }),
        info: {
          baz: "baz",
        },
      })
      .initAsParent();

    parent2
      .subState("child3", {
        schema: z.object({
          bar: z.string(),
        }),
        info: {
          bar: (data) => data.$value.bar,
        },
      })
      .initAsFinal();

    parent2
      .subState("child4", {
        schema: z.object({
          bar: z.string(),
        }),
      })
      .initAsFinal();

    // flow
    let state = machine.parse({
      $name: "state1",
      $data: {
        bar: "bar",
      },
    });

    expect(state).not.toBeNull();
    expect(state!.name).toEqual("state1");
    expect(state!.info).toStrictEqual({ foo: "foo", bar: "bar" });

    state = machine.parse({
      $name: "child1",
      $data: {
        $parent: {
          foo: "parentfoo",
        },
      },
    });

    expect(state).not.toBeNull();
    expect(state!.name).toEqual("child1");
    expect(state!.info).toStrictEqual({ foo: "parentfoo", bar: "bar" });

    state = machine.parse({
      $name: "child2",
      $data: {
        $parent: {
          foo: "parentfoo",
        },
        $value: {
          bar: "childbar",
        },
      },
    });

    expect(state).not.toBeNull();
    expect(state!.name).toEqual("child2");
    expect(state!.info).toStrictEqual({ foo: "parentfoo", bar: "childbar" });

    state = machine.parse({
      $name: "child3",
      $data: {
        $parent: {
          $parent: {
            foo: "parentfoo",
          },
          $value: {
            baz: "anything",
          },
        },
        $value: {
          bar: "childbar",
        },
      },
    });

    expect(state).not.toBeNull();
    expect(state!.name).toEqual("child3");
    expect(state!.info).toStrictEqual({ foo: "parentfoo", bar: "childbar", baz: "baz" });

    state = machine.parse({
      $name: "child4",
      $data: {
        $parent: {
          $parent: {
            foo: "parentfoo",
          },
          $value: {
            baz: "anything",
          },
        },
        $value: {
          bar: "childbar",
        },
      },
    });

    expect(state).not.toBeNull();
    expect(state!.name).toEqual("child4");
    expect(state!.info).toStrictEqual({ foo: "parentfoo", bar: "bar", baz: "baz" });
  });
});
