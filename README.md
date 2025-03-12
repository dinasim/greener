# Objective:
Create a simple counter app. Follow these steps:

![Output sample](https://github.com/moabarar/iot-workshop-2024/raw/main/assets/demo.mp4)

1. Create a new React Native App.
2. Copy and paste the source code in the frontend directory (this repo). Make sure you are able to run-it and it functions well. 
3. Download and install Azure Functions and verfiy you are able to invoke the provided functions. 
4. Run the Azure Function App and  see that the counter value is changed as expected. In our implementeation, pressing decrease/increase button will randomly change the counter value between (0,499)/(500,999), respectively.

Up until step-4, you didn't have to do anything but run our code locally on your machine. In the following steps you need to make sure that your azure function is deployed in the cloud.

5. Create a new Azure Function App in Azure. Deploy your functions, and make sure they are accessible by simply invoking them from your broweser. 
6. Change your frontend code so that it calls the azure function url on the web instead of using localhost.

# Known errors:
If you get this error (or similar one):
> Access to fetch at '...' from origin 'http://localhost' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource. If an opaque response serves your needs, set the request's mode to 'no-cors' to fetch the resource with CORS disabled.
"

When you launch the Azure Function locally, it typically runs on port 7071. Meanwhile, your local website runs on a different port (e.g., 8081). By default, the Azure Function Project disables CORS communication.

To enable CORS for all ports in your local.settings.json, you can configure the CORS policy to allow all origins, including different ports. You need to set up your local.settings.json by adding:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "python"
  },
  "Host": {
    "CORS": "*"
  }
}
```

See further information [here:](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)