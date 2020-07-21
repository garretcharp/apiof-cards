# API of Cards

This is a simplistic API for easily managing games that deal with cards. Currently the API only handles poker cards, however, in the future I am looking to support other card sets such as Uno.

Documentation: https://app.swaggerhub.com/apis-docs/gch/apiof-cards/1.0.0

## Getting Started

In order to get started developing you will want to clone or fork the repository and run `npm install` in order to install all the dependencies.
This project utilizes Vercel for serverless functions, and all of the API routes can be found in the `api` folder. All routing is file based.

This project uses AWS DynamoDB for the backend and requires a few environment variables that should go into the `.env` file.

Example `.env` file:
```
AWS_LOCATION="us-west-2"
AWS_SECRET="something-secret"
AWS_KEY="my-access"
AWS_DYNAMO_TABLE="table-name"
```

In order to run the application in dev mode run `npm run start:dev` 

Note: you might need to link vercel beforehand install the vercel cli with `npm i -g vercel`
