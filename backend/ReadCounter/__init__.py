import logging
import random
import azure.functions as func
import os
from azure.data.tables import TableClient

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')
    # Because Azure functions are stateless, we cannot locally define and manipulate local variables
    # lets just randomly draw our counter and return it.
    try:
        connection_string = os.getenv('AzureWebJobsStorage')
        with TableClient.from_connection_string(connection_string, table_name='myTable') as table:
            entity = table.get_entity("counters", "counter1")
            count = entity['value']
        return func.HttpResponse(f"{count}", status_code=200)
    except Exception as e:
        logging.error(e)
        return func.HttpResponse(f"Something went wrong {e}", status_code=500)