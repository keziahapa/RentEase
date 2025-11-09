// STK Push Request Interface
export interface STKPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
}

// STK Push Response Interface
export interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

// STK Callback Interfaces
export interface STKCallbackMetadataItem {
  Name: string;
  Value: any;
}

export interface STKCallbackMetadata {
  Item: STKCallbackMetadataItem[];
}

export interface STKCallbackData {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
  CallbackMetadata?: STKCallbackMetadata;
}

export interface STKCallback {
  Body: {
    StkCallback: STKCallbackData;
  };
}

// Validation Request Interface
export interface ValidationRequest {
  TransactionType: string;
  TransID: string;
  TransTime: string;
  TransAmount: string;
  BusinessShortCode: string;
  BillRefNumber: string;
  InvoiceNumber?: string;
  OrgAccountBalance: string;
  ThirdPartyTransID: string;
  MSISDN: string;
  FirstName: string;
  MiddleName?: string;
  LastName: string;
}

// Confirmation Request Interface
export interface ConfirmationRequest {
  TransactionType: string;
  TransID: string;
  TransTime: string;
  TransAmount: string;
  BusinessShortCode: string;
  BillRefNumber: string;
  InvoiceNumber?: string;
  OrgAccountBalance: string;
  ThirdPartyTransID: string;
  MSISDN: string;
  FirstName: string;
  MiddleName?: string;
  LastName: string;
}

// Acknowledge Response Interface
export interface AcknowledgeResponse {
  ResultCode: number;
  ResultDesc: string;
}

// Transaction Status Response Interface
export interface TransactionStatusResponse {
  ResultCode: string;
  ResultDesc: string;
  TransactionID?: string;
  ConversationID?: string;
  OriginatorConversationID?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
}

// Payment Status Interface (for internal app state)
export interface PaymentStatus {
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  message: string;
  timestamp: Date;
  checkoutRequestID?: string;
  transactionId?: string;
  amount?: number;
  resultCode?: string;
  resultDesc?: string;
}
