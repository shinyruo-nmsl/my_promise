enum Status {
  PENDING = "pending",
  FULLFILLED = "fullfilled",
  REJECTED = "rejected",
}

type Join<P> = P extends MyPromise<infer U> ? Join<U> : P;

interface IPromise<T> {
  value: T | undefined;

  status: Status;

  then<FullFilled extends (val: T) => any, Rejected extends (err: T) => any>(
    fulfilled: FullFilled,
    rejected: Rejected
  ): this["status"] extends Status.FULLFILLED
    ? IPromise<Join<ReturnType<FullFilled>>>
    : this["status"] extends Status.REJECTED
    ? IPromise<Join<ReturnType<Rejected>>>
    : IPromise<undefined>;
  then<FullFilled extends (val: T) => any>(
    fulfilled: FullFilled
  ): this["status"] extends Status.FULLFILLED
    ? IPromise<Join<ReturnType<FullFilled>>>
    : this["status"] extends Status.REJECTED
    ? this
    : IPromise<undefined>;
  then<Rejected extends (err: T) => any>(
    fulfilled: undefined,
    rejected: Rejected
  ): this["status"] extends Status.REJECTED
    ? IPromise<Join<ReturnType<Rejected>>>
    : this["status"] extends Status.FULLFILLED
    ? this
    : IPromise<undefined>;
  then(): this;

  catch<Rejected extends (err: T) => any>(
    rejected: Rejected
  ): this["status"] extends Status.REJECTED
    ? IPromise<Join<ReturnType<Rejected>>>
    : this;
  catch(): this;

  finally<OnFinal extends (val: T) => any>(
    onfinally: OnFinal
  ): this["status"] extends Status.PENDING
    ? IPromise<undefined>
    : IPromise<Join<ReturnType<OnFinal>>>;
  finally(): this;
}

export class MyPromise<T> implements IPromise<T> {
  value: T | undefined = undefined;

  status: Status = Status.PENDING;

  private _resolveCbs: (() => any)[] = [];

  private _rejectCbs: (() => any)[] = [];

  constructor(
    excutor: (resolve: (val: T) => void, reject: (err: T) => void) => any
  ) {
    try {
      excutor(
        (val: T) => this._resovle(val),
        (err: T) => this._reject(err)
      );
    } catch (err) {
      this._reject(err as T);
    }
  }

  private _resovle(val: T): void {
    if (this.status === Status.PENDING) {
      if (val instanceof MyPromise) {
        val.then(
          (val: any) => this._resovle(val),
          (err: any) => this._reject(err)
        );
      } else {
        this.status = Status.FULLFILLED;
        this.value = val;
        this._resolveCbs.forEach((cb) => cb());
      }
    }
  }

  private _reject(err: T): void {
    if (this.status === Status.PENDING) {
      this.status = Status.REJECTED;
      this.value = err;
      this._rejectCbs.forEach((cb) => cb());
      queueMicrotask(() => {
        if (!this._rejectCbs.length) {
          throw err;
        }
      });
    }
  }

  private _settledThen<K>(cb: (val: T) => K): MyPromise<Join<K>> {
    const p = new MyPromise((resolve, reject) => {
      queueMicrotask(() => {
        try {
          const val = cb(this.value!);
          if (val === p) {
            throw new Error("this is a cycle");
          }
          resolve(val as Join<K>);
        } catch (err) {
          reject(err as Join<K>);
        }
      });
    });
    return p as MyPromise<Join<K>>;
  }

  private _unSettledThen<
    FullFilled extends (val: T) => any,
    Rejected extends (err: T) => any
  >(fulfilled?: FullFilled, rejected?: Rejected): MyPromise<undefined> {
    const p = new MyPromise((resovle, reject) => {
      if (fulfilled) {
        this._resolveCbs.push(() => {
          try {
            const val = fulfilled(this.value!);
            if (val === p) {
              throw new Error("this is a cycle");
            }
            resovle(val);
          } catch (err) {
            reject(err as any);
          }
        });
      }
      if (rejected) {
        this._rejectCbs.push(() => {
          try {
            const val = rejected(this.value!);
            if (val === p) {
              throw new Error("this is a cycle");
            }
            resovle(val);
          } catch (err) {
            reject(err as any);
          }
        });
      }
    });
    return p as MyPromise<undefined>;
  }

  then<FullFilled extends (val: T) => any, Rejected extends (err: T) => any>(
    fulfilled: FullFilled,
    rejected: Rejected
  ): this["status"] extends Status.FULLFILLED
    ? IPromise<Join<ReturnType<FullFilled>>>
    : this["status"] extends Status.REJECTED
    ? IPromise<Join<ReturnType<Rejected>>>
    : IPromise<undefined>;
  then<FullFilled extends (val: T) => any>(
    fulfilled: FullFilled
  ): this["status"] extends Status.FULLFILLED
    ? IPromise<Join<ReturnType<FullFilled>>>
    : this["status"] extends Status.REJECTED
    ? this
    : IPromise<undefined>;
  then<Rejected extends (err: T) => any>(
    fulfilled: undefined,
    rejected: Rejected
  ): this["status"] extends Status.REJECTED
    ? IPromise<Join<ReturnType<Rejected>>>
    : this["status"] extends Status.FULLFILLED
    ? this
    : IPromise<undefined>;
  then(): this;
  then<FullFilled extends (val: T) => any, Rejected extends (err: T) => any>(
    fulfilled?: FullFilled,
    rejected?: Rejected
  ): any {
    if (fulfilled && rejected) {
      if (this.status === Status.FULLFILLED) {
        return this._settledThen(fulfilled);
      } else if (this.status === Status.REJECTED) {
        return this._settledThen(rejected);
      } else {
        return this._unSettledThen(fulfilled, rejected);
      }
    } else if (fulfilled) {
      if (this.status === Status.FULLFILLED) {
        return this._settledThen(fulfilled);
      } else if (this.status === Status.REJECTED) {
        return this;
      } else {
        return this._unSettledThen(fulfilled, rejected);
      }
    } else if (rejected) {
      if (this.status === Status.FULLFILLED) {
        return this;
      } else if (this.status === Status.REJECTED) {
        return this._settledThen(rejected);
      } else {
        return this._unSettledThen(fulfilled, rejected);
      }
    } else {
      return this;
    }
  }

  catch<Rejected extends (err: T) => any>(
    rejected: Rejected
  ): this["status"] extends Status.REJECTED
    ? IPromise<Join<ReturnType<Rejected>>>
    : this;
  catch(): this;
  catch<Rejected extends (err: T) => any>(rejected?: Rejected): any {
    if (rejected) {
      if (this.status === Status.REJECTED) {
        return this._settledThen(rejected);
      } else {
        return this;
      }
    } else {
      return this;
    }
  }

  finally<OnFinal extends (val: T) => any>(
    onfinally: OnFinal
  ): this["status"] extends Status.PENDING
    ? IPromise<undefined>
    : IPromise<Join<ReturnType<OnFinal>>>;
  finally(): this;
  finally<OnFinal extends (val: T) => any>(onfinally?: OnFinal) {
    if (onfinally) {
      if (this.status === Status.PENDING) {
        return this._unSettledThen(onfinally);
      } else {
        return this._settledThen(onfinally);
      }
    } else {
      return this;
    }
  }
}
