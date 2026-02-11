import boto3
# import ollama


# Initialize the Textract client
textract = boto3.client("textract", region_name="us-east-1")

# Path to your receipt image
document_path = "1.jpg"

# Read the document
with open(document_path, "rb") as document:
    image_bytes = document.read()

res = ""

# Call Textract to analyze the document
response = textract.analyze_document(
    Document={"Bytes": image_bytes},
    FeatureTypes=["FORMS", "TABLES"],
)

for block in response["Blocks"]:
    if block["BlockType"] == "LINE":
        text = block["Text"]
        # Extract product names
        res += str(text) + "\n"

# stream = ollama.generate(
#     model="llama3.1:8b",
#     prompt=f"{res} This is a receipt from my instacart order. I want you to create a valid json file of all the products purchased, the taxes incurred and the discount applied. If there is a product like 'Peeled Baby Cut Carrots (16 OZ bag) $1.49 1 X $1.19 $1.19' the first price mentioned ($1.49), the quantity is 1 and it is multiplied by '1.19' then consider the original price is 1.19 as the OCR which I used doesnt detect strike through characters so it mentions both the prices.",
#     stream=True,
# )

# for chunk in stream:
#     print(chunk["response"], end="", flush=True)

print(res)