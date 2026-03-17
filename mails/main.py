import os
import time
import random
import base64

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

def authenticate():
    creds = None

    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)

        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    return creds


def send_all_drafts():
    creds = authenticate()
    service = build('gmail', 'v1', credentials=creds)

    drafts = service.users().drafts().list(userId='me').execute().get('drafts', [])

    print(f"Found {len(drafts)} drafts")

    for i, draft in enumerate(drafts):

        service.users().drafts().send(
            userId='me',
            body={'id': draft['id']}
        ).execute()

        print(f"Sent draft {i+1}")

        delay = random.uniform(4, 7)
        print(f"Waiting {delay:.2f} seconds")
        time.sleep(delay)


if __name__ == "__main__":
    send_all_drafts()