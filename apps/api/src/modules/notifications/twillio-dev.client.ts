export class PrismClient {
  prismUrl: string;
  requestClient: any;

  constructor(prismUrl: string, requestClient: any) {
    this.prismUrl = prismUrl;
    this.requestClient = requestClient;
  }

  request(opts: any) {
    // Rewrite the target URI from Twilio to your local server
    opts.uri = opts.uri.replace(/^https\:\/\/.*?\.twilio\.com/, this.prismUrl);
    return this.requestClient.request(opts);
  }
}
