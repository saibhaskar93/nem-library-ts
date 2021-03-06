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

import {expect} from "chai";
import {from} from "rxjs";
import {AssetHttp} from "../../../src/infrastructure/AssetHttp";
import {AssetId} from "../../../src/models/asset/AssetId";
import {NetworkTypes} from "../../../src/models/node/NetworkTypes";
import {NEMLibrary} from "../../../src/NEMLibrary";
import {flatMap, toArray} from "rxjs/operators";

describe("TransactionWithAssets", () => {
  let mosaicHttp: AssetHttp;

  before(() => {
    NEMLibrary.bootstrap(NetworkTypes.TEST_NET);
    mosaicHttp = new AssetHttp();
  });

  after(() => {
    NEMLibrary.reset();
  });

  it("Create runtime AssetTransferable with a server:mosaic", (done) => {
    mosaicHttp.getAssetTransferableWithAbsoluteAmount(new AssetId("server", "mosaic"), 1)
      .subscribe((assetTransferable) => {
        expect(assetTransferable.relativeQuantity()).to.be.equal(1);
        expect(assetTransferable.absoluteQuantity()).to.be.equal(1);
        done();
      });
  });

  it("Create runtime AssetTransferable with a server:other", (done) => {
    mosaicHttp.getAssetTransferableWithRelativeAmount(new AssetId("server", "other"), 1)
      .subscribe((assetTransferable) => {
        expect(assetTransferable.absoluteQuantity()).to.be.equal(1000000);
        expect(assetTransferable.relativeQuantity()).to.be.equal(1);
        done();
      });
  });

  it("Fetch different asset and add the xem", (done) => {
    from([
      {namespace: "server", mosaic: "mosaic", amount: 1},
      {namespace: "server", mosaic: "other", amount: 1},
    ])
      .pipe(
        flatMap((_) => mosaicHttp.getAssetTransferableWithAbsoluteAmount(new AssetId(_.namespace, _.mosaic), _.amount)),
        toArray()
      )
      .subscribe((x) => {
        expect(x).to.have.length(2);
        done();
      });
  });
});
