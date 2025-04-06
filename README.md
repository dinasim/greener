# Objective
We will extend EX1 to support:
* Saving the counter on the cloud
* Broadcasting the new counter value using SignalR

We recommend watching the tutorial video and reviewing the slides on Moodle. We have provided a demo demonstrating the app's functionality.

Below, we provide useful links to assist you in the implementation.

# Azure Tables
Use Azure Tables to store our counter in the cloud. The following links may be helpful:

* An overview of Azure Tables can be found [here](https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-overview).
* The Azure Tables client can be used to access Azure Storage or Cosmos accounts. The SDK is supported in multiple languages, including [Python](https://learn.microsoft.com/en-us/python/api/overview/azure/data-tables-readme?view=azure-python), [C#](https://learn.microsoft.com/en-us/dotnet/api/overview/azure/data.tables-readme?view=azure-dotnet), and [JavaScript](https://learn.microsoft.com/en-us/javascript/api/overview/azure/data-tables-readme?view=azure-node-latest).
* Create a new table with a single entity representing our counter (see [here](https://learn.microsoft.com/en-us/azure/data-explorer/create-table-wizard)).
* Edit your Azure Functions, such as Increase/Decrease counter, to directly manipulate the counter in Azure.
* In our implementation, we also added a new function that reads the counter value. We use this to initialize the counter value on the client side upon startup.

# SignalR
We will use the SignalR service to broadcast updates to all connected clients whenever there is a change in the counter value. Review the tutorial slides to understand the process. Here are some related links to help you understand how SignalR works:

* We recommend following the guidelines provided in class. However, feel free to explore the documentation and references here:
* [Here](https://learn.microsoft.com/en-us/azure/azure-signalr/signalr-quickstart-azure-functions-python?pivots=python-mode-configuration) is an example of a serverless app using SignalR. References to Python, C#, and JavaScript languages are also available.
* Examples using SignalR can be found in [this repository](https://github.com/aspnet/AzureSignalR-samples). The code in the repo is not React Native-based and is more relevant for web apps, but it might be useful for understanding how SignalR works.
