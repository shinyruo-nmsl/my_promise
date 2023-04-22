import { MyPromise } from "./promise";

const p = new MyPromise<string>((resolve, reject) => {
  setTimeout(() => {
    resolve("1");
  });
});

const p2 = p.then((val) => 2);
