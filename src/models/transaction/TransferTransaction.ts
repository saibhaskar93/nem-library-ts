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

import {TransactionDTO} from "../../infrastructure/transaction/TransactionDTO";
import {TransferTransactionDTO} from "../../infrastructure/transaction/TransferTransactionDTO";
import {Address} from "../account/Address";
import {PublicAccount} from "../account/PublicAccount";
import {Asset} from "../asset/Asset";
import {AssetDefinition} from "../asset/AssetDefinition";
import {AssetId} from "../asset/AssetId";
import {AssetTransferable} from "../asset/AssetTransferable";
import {XEM} from "../asset/XEM";
import {EncryptedMessage} from "./EncryptedMessage";
import {Message} from "./Message";
import {PlainMessage} from "./PlainMessage";
import {TimeWindow} from "./TimeWindow";
import {Transaction} from "./Transaction";
import {TransactionInfo} from "./TransactionInfo";
import {TransactionTypes} from "./TransactionTypes";

/**
 * Transfer transactions contain data about transfers of XEM or assets to another account.
 */
export class TransferTransaction extends Transaction {
  /**
   * The fee for the transaction. The higher the fee, the higher the priority of the transaction. Transactions with high priority get included in a block before transactions with lower priority.
   */
  public readonly fee: number;

  /**
   * The address of the recipient.
   */
  public readonly recipient: Address;

  /**
   * The xem of XEM that is transferred from sender to recipient.
   */
  private readonly _xem: XEM;

  /**
   * Optionally a transaction can contain a message. In this case the transaction contains a message substructure. If not the field is null.
   */
  public readonly message: PlainMessage | EncryptedMessage;

  /**
   * The array of Asset objects.
   */
  private readonly _assets?: Asset[];

  /**
   * @internal
   * @param recipient
   * @param amount
   * @param timeWindow
   * @param version
   * @param fee
   * @param message
   * @param signature
   * @param asset
   * @param sender
   * @param transactionInfo
   */
  constructor(recipient: Address,
              amount: XEM,
              timeWindow: TimeWindow,
              version: number,
              fee: number,
              message: PlainMessage | EncryptedMessage,
              signature?: string,
              asset?: Asset[],
              sender?: PublicAccount,
              transactionInfo?: TransactionInfo) {
    super(TransactionTypes.TRANSFER, version, timeWindow, signature, sender, transactionInfo);
    this.fee = fee;
    this.recipient = recipient;
    this._xem = amount;
    this.message = message;
    this._assets = asset;
  }

  /**
   * in case that the transfer transaction contains assets, it throws an error
   * @returns {XEM}
   */
  public xem(): XEM {
    if (this.containAssets()) { throw new Error("contain assets"); }
    return this._xem;
  }

  /**
   * in case that the transfer transaction does not contain assets, it throws an error
   * @returns {Asset[]}
   */
  public assets(): Asset[] {
    if (this.containAssets()) {
      return this._assets!.map((mosaic) =>
        new Asset(mosaic.assetId, (mosaic.quantity * (this._xem.relativeQuantity()))));
    }
    throw new Error("Does not contain assets");
  }

  /**
   *
   * @returns {boolean}
   */
  public containAssets() {
    return this._assets !== undefined && this._assets.length > 0;
  }

  /**
   * all the Asset Identifiers of the attached assets
   * @returns {AssetId[]}
   */
  public assetsIds(): AssetId[] {
    if (!this.containAssets()) { throw new Error("does not contain assets"); }
    return this._assets!.map((_) => _.assetId);
  }

  /**
   * Create DTO of TransferTransaction
   * @returns {TransferTransactionDTO}
   */
  public toDTO(): TransactionDTO {
    const version = this.networkVersion ? this.networkVersion : this.version;
    return this.serializeDTO({
      signer: this.signer ? this.signer.publicKey : undefined,
      deadline: this.timeWindow.deadlineToDTO(),
      timeStamp: this.timeWindow.timeStampToDTO(),
      signature: this.signature,
      type: this.type,
      version,
      mosaics: this._assets === undefined ? undefined : this._assets.map((mosaic) => new Asset(mosaic.assetId, mosaic.quantity).toDTO()),
      fee: this.fee,
      recipient: this.recipient.plain(),
      amount: this._xem.absoluteQuantity(),
      message: this.message.toDTO(),
    } as TransferTransactionDTO);
  }

  /**
   * Create a TransferTransaction object
   * @param timeWindow
   * @param recipient
   * @param xem
   * @param message
   * @returns {TransferTransaction}
   */
  public static create(timeWindow: TimeWindow,
                       recipient: Address,
                       xem: XEM,
                       message: PlainMessage | EncryptedMessage): TransferTransaction {
    if (message instanceof EncryptedMessage && recipient.plain() !== message.recipientPublicAccount!.address.plain()) { throw new Error("Recipient address and recipientPublicAccount don't match"); }
    let fee = Math.floor(0.05 * this.calculateMinimum(xem.relativeQuantity()) * 1000000);
    if (message.payload.length !== 0) {
      fee += 0.05 * (Math.floor((message.payload.length / 2) / 32) + 1) * 1000000;
    }
    return new TransferTransaction(recipient, xem, timeWindow, 1, fee, message, undefined, undefined);
  }

  /**
   * @internal
   * @param amount
   * @returns {number}
   */
  private static calculateMinimum(amount): number {
    const fee = Math.floor(Math.max(1, amount / 10000));
    return fee > 25 ? 25 : fee;
  }

  /**
   * Create a TransferTransaction object
   * @param timeWindow
   * @param recipient
   * @param assets
   * @param message
   * @returns {TransferTransaction}
   */
  // tslint:disable-next-line:member-ordering
  public static createWithAssets(timeWindow: TimeWindow,
                                 recipient: Address,
                                 assets: AssetTransferable[],
                                 message: PlainMessage | EncryptedMessage): TransferTransaction {
    if (message instanceof EncryptedMessage && recipient.plain() !== message.recipientPublicAccount!.address.plain()) { throw new Error("Recipient address and recipientPublicAccount don't match"); }
    const multiplier = new XEM(1);
    let fee = 0;
    assets.map((mosaic) => {
      if (mosaic.properties.divisibility === 0 && mosaic.properties.initialSupply <= 10000) {
        fee += 0.05 * 1000000;
      } else {
        const maxMosaicQuantity = 9000000000000000;

        const totalMosaicQuantity = mosaic.properties.initialSupply * Math.pow(10, mosaic.properties.divisibility);
        const supplyRelatedAdjustment = Math.floor(0.8 * Math.log(Math.floor(maxMosaicQuantity / totalMosaicQuantity)));

        const quantity = mosaic.quantity;

        const xemFee = Math.min(25, Math.floor((8999999999 * quantity) / (totalMosaicQuantity * 10000)));

        const unweightFee = Math.max(1, xemFee - supplyRelatedAdjustment);
        fee += 0.05 * 1e6 * unweightFee ;
      }
    });
    if (message.payload.length !== 0) {
      fee += 0.05 * (Math.floor((message.payload.length / 2) / 32) + 1) * 1000000;
    }
    return new TransferTransaction(recipient,
      multiplier,
      timeWindow,
      2,
      fee,
      message,
      undefined,
      assets.map((_) => new Asset(_.assetId, _.absoluteQuantity())));
  }

}
