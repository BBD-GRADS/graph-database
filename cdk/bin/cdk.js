#!/usr/bin/env node

const cdk = require("aws-cdk-lib");
const { CdkStack } = require("../lib/cdk-stack");

const app = new cdk.App();
new CdkStack(app, "CdkStack", {
  tags: {
    owner: "jacques.mouton@bbd.co.za",
    "created-using": "cdk",
  },
  env: { account: "978251882572", region: "eu-west-1" },
});
