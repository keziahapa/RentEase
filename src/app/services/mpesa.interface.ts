// interfaces/mpesa.interface.ts
export interface ValidationRequest {
  TransactionType: string;
  TransID: string;
  TransTime: string;
  TransAmount: string;
  BusinessShortCode: string;
  BillRefNumber: string;
  InvoiceNumber: string;
  OrgAccountBalance: string;
  ThirdPartyTransID: string;
  MSISDN: string;
  FirstName: string;
  MiddleName: string;
  LastName: string;
}

export interface STKPushCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: string;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: any;
        }>;
      };
    };
  };
}

export interface AcknowledgeResponse {
  ResultCode: number;
  ResultDesc: string;
}

export interface STKPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc?: string;
}

export interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface PaymentStatus {
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  message: string;
  transactionId?: string;
  amount?: number;
  timestamp?: Date;
}

export interface PaymentHistoryItem extends PaymentStatus {
  id?: string;
  checkoutRequestId?: string;
  phoneNumber?: string;
  accountReference?: string;
  transactionDesc?: string;
}

export interface PaymentAnalytics {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  totalAmount: number;
  averageAmount: number;
  pendingPayments: number;
  cancelledPayments: number;
}

export interface TransactionResults {
  TransactionType: string;
  TransID: string;
  TransTime: string;
  TransAmount: string;
  BusinessShortCode: string;
  BillRefNumber: string;
  InvoiceNumber: string;
  OrgAccountBalance: string;
  ThirdPartyTransID: string;
  MSISDN: string;
  FirstName: string;
  MiddleName: string;
  LastName: string;
}

export interface CallbackMetadata {
  Item: Array<{
    Name: string;
    Value: any;
  }>;
}

export interface StkCallBack {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
  CallbackMetadata: CallbackMetadata;
}

export interface Body {
  StkCallback: StkCallBack;
}

export interface ExpressResult {
  Body: Body;
}

export interface Item {
  Name: string;
  Value: any;
}

export interface ConfirmationRequest {
  TransactionType?: string;
  TransID?: string;
  TransTime?: string;
  TransAmount?: string;
  BusinessShortCode?: string;
  BillRefNumber?: string;
  InvoiceNumber?: string;
  OrgAccountBalance?: string;
  ThirdPartyTransID?: string;
  MSISDN?: string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
  [key: string]: any;
}

export interface PaymentNotification {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  duration?: number;
}

export interface PaymentConfig {
  maxAmount: number;
  minAmount: number;
  allowedPhonePrefixes: string[];
  currency: string;
  timeout: number;
  retryAttempts: number;
}

export interface PaymentReceipt {
  receiptNumber: string;
  transactionId: string;
  amount: number;
  phoneNumber: string;
  accountReference: string;
  transactionDate: Date;
  status: string;
  merchantRequestId: string;
  checkoutRequestId: string;
}

export interface B2CRequest {
  phoneNumber: string;
  amount: number;
  commandID?: string;
  remarks: string;
  occasion?: string;
}

export interface B2CResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

export interface AccountBalanceResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
  Result: {
    ResultType: number;
    ResultCode: number;
    ResultDesc: string;
    OriginatorConversationID: string;
    ConversationID: string;
    TransactionID: string;
    ResultParameters: {
      ResultParameter: Array<{
        Key: string;
        Value: any;
      }>;
    };
  };
}

export interface TransactionStatusRequest {
  transactionID: string;
  commandID?: string;
  partyA?: string;
  identifierType?: number;
  remarks?: string;
  occasion?: string;
}

export interface TransactionStatusResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
  Result: {
    ResultType: number;
    ResultCode: number;
    ResultDesc: string;
    OriginatorConversationID: string;
    ConversationID: string;
    TransactionID: string;
    ResultParameters: {
      ResultParameter: Array<{
        Key: string;
        Value: any;
      }>;
    };
    ReferenceData: {
      ReferenceItem: Array<{
        Key: string;
        Value: string;
      }>;
    };
  };
}

export interface C2BRegisterURLRequest {
  validationURL: string;
  confirmationURL: string;
  responseType: string;
  shortCode: string;
}

export interface C2BRegisterURLResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

export interface ReversalRequest {
  transactionID: string;
  amount: number;
  receiverParty: string;
  receiverIdentifierType?: string;
  resultURL?: string;
  queueTimeOutURL?: string;
  remarks: string;
  occasion?: string;
}

export interface ReversalResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}