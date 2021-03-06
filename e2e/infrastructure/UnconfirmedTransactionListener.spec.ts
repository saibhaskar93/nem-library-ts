/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2017 NEM
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import {TransactionHttp} from "../../src/infrastructure/TransactionHttp";
import {UnconfirmedTransactionListener} from "../../src/infrastructure/UnconfirmedTransactionListener";
import {Account} from "../../src/models/account/Account";
import {Address} from "../../src/models/account/Address";
import {XEM} from "../../src/models/asset/XEM";
import {NetworkTypes} from "../../src/models/node/NetworkTypes";
import {EmptyMessage} from "../../src/models/transaction/PlainMessage";
import {TimeWindow} from "../../src/models/transaction/TimeWindow";
import {TransferTransaction} from "../../src/models/transaction/TransferTransaction";
import {NEMLibrary} from "../../src/NEMLibrary";
import {delay, flatMap} from "rxjs/operators";
import {of} from "rxjs";

declare let process: any;

describe("UnconfirmedTransactionListener", () => {
  const privateKey: string = process.env.PRIVATE_KEY;
  let transactionHttp: TransactionHttp;
  let account: Account;

  before(() => {
    // Initialize NEMLibrary for TEST_NET Network
    NEMLibrary.bootstrap(NetworkTypes.TEST_NET);
    account = Account.createWithPrivateKey(privateKey);
    transactionHttp = new TransactionHttp();
  });

  after(() => {
    NEMLibrary.reset();
  });

  it("should listen the next data", (done) => {
    const address = new Address("TDM3DO-ZM5WJ3-ZRBPSM-YRU6JS-WKUCAH-5VIPOF-4W7K");

    const transferTransaction = TransferTransaction.create(
      TimeWindow.createWithDeadline(),
      address,
      new XEM(0),
      EmptyMessage,
    );

    const subscribe = new UnconfirmedTransactionListener().given(account.address)
      .subscribe((x) => {
        console.log(x);
        subscribe.unsubscribe();
        done();
      }, (err) => {
        console.log(err);
      });

    const transaction = account.signTransaction(transferTransaction);

    of(1)
      .pipe(
        delay(3000),
        flatMap((ignored) => transactionHttp.announceTransaction(transaction))
      )
      .subscribe((x) => {
        console.log(x);
      });
  });
});
