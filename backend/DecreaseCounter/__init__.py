import logging
import azure.functions as func
import random

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')
    # Because Azure functions are stateless, we cannot locally define and manipulate local variables
    # lets just randomly draw our counter and return it.
    count = random.randint(0, 499)
    return func.HttpResponse(f"{count}", status_code=200)
