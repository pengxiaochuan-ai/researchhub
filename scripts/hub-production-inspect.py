#!/usr/bin/env python3
import base64
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import tempfile
import urllib.parse

OPS=pathlib.Path('/srv/researchhub/ops')
TAG='hub-runtime-6ad32a57-45351976297001'
MANIFEST='ab886fbdb0a2088e725c31fde1d7a203a52611cc01f84efeb099e8ad8b04cbd1'
IMAGE='__PG_IMAGE__'
IMAGE_URL='__PG_IMAGE_URL__'
IMAGE_SHA='__PG_IMAGE_SHA__'
NODE=base64.b64decode('aW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydC9zdHJpY3QnOwppbXBvcnQge2NyZWF0ZUhhc2h9IGZyb20gJ25vZGU6Y3J5cHRvJzsKaW1wb3J0IHtyZWFkUmVzZWFyY2hSdW50aW1lQ29uZmlnfSBmcm9tICcuL3NlcnZlci9yZXNlYXJjaC1ydW50aW1lL2NvbmZpZy5tanMnOwppbXBvcnQge3J1bnRpbWVEZXBlbmRlbmNpZXN9IGZyb20gJy4vc2VydmVyL3Jlc2VhcmNoLXJ1bnRpbWUvZGVwZW5kZW5jaWVzLm1qcyc7CmltcG9ydCB7YmluZFJ1bnRpbWVUcmFuc2FjdGlvbnMsdmVyaWZ5UnVudGltZVNjaGVtYSx3aXRoRGVwbG95bWVudFRyYW5zYWN0aW9ufSBmcm9tICcuL3NlcnZlci9kYXRhYmFzZS90cmFuc2FjdGlvbnMubWpzJzsKY29uc3Qgc3FsPUJ1ZmZlci5mcm9tKCdMUzBnUVhCd2JIa2djMlZ3WVhKaGRHVnNlU0JpWldadmNtVWdZV04wYVhaaGRHbHVaeUJqWlc1MFpYSWdZMjl1Wm1sbmRYSmhkR2x2Ymk0Z1RtOGdZWFYwYjIxaGRHbGpJRzFwWjNKaGRHbHZiaTRLTFMwZ1FITjBZWFJsYldWdWRBcERVa1ZCVkVVZ1UwTklSVTFCSUhKb1gyTmxiblJsY2pzS0xTMGdRSE4wWVhSbGJXVnVkQXBEVWtWQlZFVWdWRUZDVEVVZ2NtaGZZMlZ1ZEdWeUxtTmxiblJsY2lBb0NpQjBaVzVoYm5SZmFXUWdkR1Y0ZENCT1QxUWdUbFZNVEN3Z2MzUjFaSGxmYVdRZ2RHVjRkQ0JPVDFRZ1RsVk1UQ3dnYVdRZ2RHVjRkQ0JPVDFRZ1RsVk1UQ3dLSUdOdlpHVWdkR1Y0ZENCT1QxUWdUbFZNVENCRFNFVkRTeWhqYjJSbElINGdKMTViUVMxYU1DMDVYVnRCTFZvd0xUbGZMVjE3TUN3ek1YMGtKeWtzQ2lCdVlXMWxJSFJsZUhRZ1RrOVVJRTVWVEV3Z1EwaEZRMHNvYkdWdVozUm9LR0owY21sdEtHNWhiV1VwS1NCQ1JWUlhSVVZPSURFZ1FVNUVJREV5TUNrc0lHRmpkR2wyWlNCaWIyOXNaV0Z1SUU1UFZDQk9WVXhNSUVSRlJrRlZURlFnZEhKMVpTd0tJRkJTU1UxQlVsa2dTMFZaS0hSbGJtRnVkRjlwWkN4emRIVmtlVjlwWkN4cFpDa3NJRlZPU1ZGVlJTaDBaVzVoYm5SZmFXUXNjM1IxWkhsZmFXUXNZMjlrWlNrc0NpQkdUMUpGU1VkT0lFdEZXU2gwWlc1aGJuUmZhV1FzYzNSMVpIbGZhV1FwSUZKRlJrVlNSVTVEUlZNZ2NtaGZjbVZ6WldGeVkyZ3VjM1IxWkhsZlltbHVaR2x1WnloMFpXNWhiblJmYVdRc2FXUXBDaWs3Q2kwdElFQnpkR0YwWlcxbGJuUUtRMUpGUVZSRklGUkJRa3hGSUhKb1gyTmxiblJsY2k1d2JHRnVJQ2dLSUhSbGJtRnVkRjlwWkNCMFpYaDBJRTVQVkNCT1ZVeE1MQ0J6ZEhWa2VWOXBaQ0IwWlhoMElFNVBWQ0JPVlV4TUxDQmpaVzUwWlhKZmFXUWdkR1Y0ZENCT1QxUWdUbFZNVEN3Z2RtVnljMmx2YmlCcGJuUmxaMlZ5SUU1UFZDQk9WVXhNSUVOSVJVTkxLSFpsY25OcGIyNCtNQ2tzQ2lCMFlYSm5aWFFnYVc1MFpXZGxjaUJPVDFRZ1RsVk1UQ0JEU0VWRFN5aDBZWEpuWlhRK01Da3NJSE4wWVhKMFgyUmhkR1VnWkdGMFpTQk9UMVFnVGxWTVRDd2daVzVrWDJSaGRHVWdaR0YwWlN3S0lISmxZWE52YmlCMFpYaDBJRTVQVkNCT1ZVeE1JRU5JUlVOTEtHeGxibWQwYUNoaWRISnBiU2h5WldGemIyNHBLU0JDUlZSWFJVVk9JREVnUVU1RUlEVXdNQ2tzSUdOeVpXRjBaV1JmWW5rZ2RHVjRkQ0JPVDFRZ1RsVk1UQ0JTUlVaRlVrVk9RMFZUSUhCMVlteHBZeTVoWTJOdmRXNTBLR2xrS1N3S0lHTnlaV0YwWldSZllYUWdkR2x0WlhOMFlXMXdkSG9nVGs5VUlFNVZURXdnUkVWR1FWVk1WQ0J1YjNjb0tTd2dZWEJ3Y205MlpXUmZZbmtnZEdWNGRDQlNSVVpGVWtWT1EwVlRJSEIxWW14cFl5NWhZMk52ZFc1MEtHbGtLU3dnWVhCd2NtOTJaV1JmWVhRZ2RHbHRaWE4wWVcxd2RIb3NDaUJRVWtsTlFWSlpJRXRGV1NoMFpXNWhiblJmYVdRc2MzUjFaSGxmYVdRc1kyVnVkR1Z5WDJsa0xIWmxjbk5wYjI0cExBb2dSazlTUlVsSFRpQkxSVmtvZEdWdVlXNTBYMmxrTEhOMGRXUjVYMmxrTEdObGJuUmxjbDlwWkNrZ1VrVkdSVkpGVGtORlV5QnlhRjlqWlc1MFpYSXVZMlZ1ZEdWeUtIUmxibUZ1ZEY5cFpDeHpkSFZrZVY5cFpDeHBaQ2tzQ2lCRFNFVkRTeWhsYm1SZlpHRjBaU0JKVXlCT1ZVeE1JRTlTSUdWdVpGOWtZWFJsSUQ0OUlITjBZWEowWDJSaGRHVXBMQ0JEU0VWRFN5Z29ZWEJ3Y205MlpXUmZZbmtnU1ZNZ1RsVk1UQ2s5S0dGd2NISnZkbVZrWDJGMElFbFRJRTVWVEV3cEtRb3BPd290TFNCQWMzUmhkR1Z0Wlc1MENrTlNSVUZVUlNCVlRrbFJWVVVnU1U1RVJWZ2diMjVsWDNCbGJtUnBibWRmWTJWdWRHVnlYM0JzWVc0Z1QwNGdjbWhmWTJWdWRHVnlMbkJzWVc0b2RHVnVZVzUwWDJsa0xITjBkV1I1WDJsa0xHTmxiblJsY2w5cFpDa2dWMGhGVWtVZ1lYQndjbTkyWldSZllYUWdTVk1nVGxWTVREc0tMUzBnUUhOMFlYUmxiV1Z1ZEFwRFVrVkJWRVVnVkVGQ1RFVWdjbWhmWTJWdWRHVnlMbUZqWTJWemN5QW9DaUIwWlc1aGJuUmZhV1FnZEdWNGRDQk9UMVFnVGxWTVRDd2djM1IxWkhsZmFXUWdkR1Y0ZENCT1QxUWdUbFZNVEN3Z1kyVnVkR1Z5WDJsa0lIUmxlSFFnVGs5VUlFNVZURXdzSUdGamRHOXlYMmxrSUhSbGVIUWdUazlVSUU1VlRFd2dVa1ZHUlZKRlRrTkZVeUJ3ZFdKc2FXTXVZV05qYjNWdWRDaHBaQ2tzQ2lCaFkzUnBkbVVnWW05dmJHVmhiaUJPVDFRZ1RsVk1UQ0JFUlVaQlZVeFVJSFJ5ZFdVc0lGQlNTVTFCVWxrZ1MwVlpLSFJsYm1GdWRGOXBaQ3h6ZEhWa2VWOXBaQ3hqWlc1MFpYSmZhV1FzWVdOMGIzSmZhV1FwTEFvZ1JrOVNSVWxIVGlCTFJWa29kR1Z1WVc1MFgybGtMSE4wZFdSNVgybGtMR05sYm5SbGNsOXBaQ2tnVWtWR1JWSkZUa05GVXlCeWFGOWpaVzUwWlhJdVkyVnVkR1Z5S0hSbGJtRnVkRjlwWkN4emRIVmtlVjlwWkN4cFpDa0tLVHNLTFMwZ1FITjBZWFJsYldWdWRBcERVa1ZCVkVVZ1ZFRkNURVVnY21oZlkyVnVkR1Z5TG1GMGRISnBZblYwYVc5dUlDZ0tJSFJsYm1GdWRGOXBaQ0IwWlhoMElFNVBWQ0JPVlV4TUxDQnpkSFZrZVY5cFpDQjBaWGgwSUU1UFZDQk9WVXhNTENCbGJuSnZiR3h0Wlc1MFgybGtJSFJsZUhRZ1RrOVVJRTVWVEV3Z1VrVkdSVkpGVGtORlV5QndkV0pzYVdNdWMzUjFaSGxmWlc1eWIyeHNiV1Z1ZENocFpDa3NDaUIyWlhKemFXOXVJR2x1ZEdWblpYSWdUazlVSUU1VlRFd2dRMGhGUTBzb2RtVnljMmx2Ymo0d0tTd2dZMlZ1ZEdWeVgybGtJSFJsZUhRZ1RrOVVJRTVWVEV3c0lISmxZWE52YmlCMFpYaDBJRTVQVkNCT1ZVeE1JRU5JUlVOTEtHeGxibWQwYUNoaWRISnBiU2h5WldGemIyNHBLU0JDUlZSWFJVVk9JREVnUVU1RUlEVXdNQ2tzQ2lCamNtVmhkR1ZrWDJKNUlIUmxlSFFnVGs5VUlFNVZURXdnVWtWR1JWSkZUa05GVXlCd2RXSnNhV011WVdOamIzVnVkQ2hwWkNrc0lHTnlaV0YwWldSZllYUWdkR2x0WlhOMFlXMXdkSG9nVGs5VUlFNVZURXdnUkVWR1FWVk1WQ0J1YjNjb0tTd0tJR0Z3Y0hKdmRtVmtYMko1SUhSbGVIUWdVa1ZHUlZKRlRrTkZVeUJ3ZFdKc2FXTXVZV05qYjNWdWRDaHBaQ2tzSUdGd2NISnZkbVZrWDJGMElIUnBiV1Z6ZEdGdGNIUjZMQW9nVUZKSlRVRlNXU0JMUlZrb2RHVnVZVzUwWDJsa0xITjBkV1I1WDJsa0xHVnVjbTlzYkcxbGJuUmZhV1FzZG1WeWMybHZiaWtzQ2lCR1QxSkZTVWRPSUV0RldTaDBaVzVoYm5SZmFXUXNjM1IxWkhsZmFXUXNZMlZ1ZEdWeVgybGtLU0JTUlVaRlVrVk9RMFZUSUhKb1gyTmxiblJsY2k1alpXNTBaWElvZEdWdVlXNTBYMmxrTEhOMGRXUjVYMmxrTEdsa0tTd0tJRU5JUlVOTEtDaGhjSEJ5YjNabFpGOWllU0JKVXlCT1ZVeE1LVDBvWVhCd2NtOTJaV1JmWVhRZ1NWTWdUbFZNVENrcENpazdDaTB0SUVCemRHRjBaVzFsYm5RS1ExSkZRVlJGSUZWT1NWRlZSU0JKVGtSRldDQnZibVZmY0dWdVpHbHVaMTloZEhSeWFXSjFkR2x2YmlCUFRpQnlhRjlqWlc1MFpYSXVZWFIwY21saWRYUnBiMjRvZEdWdVlXNTBYMmxrTEhOMGRXUjVYMmxrTEdWdWNtOXNiRzFsYm5SZmFXUXBJRmRJUlZKRklHRndjSEp2ZG1Wa1gyRjBJRWxUSUU1VlRFdzdDaTB0SUVCemRHRjBaVzFsYm5RS1ExSkZRVlJGSUVaVlRrTlVTVTlPSUhKb1gyTmxiblJsY2k1MllXeHBaR0YwWlY5d1lYSmxiblFvS1NCU1JWUlZVazVUSUhSeWFXZG5aWElnVEVGT1IxVkJSMFVnY0d4d1ozTnhiQ0JUUlZRZ2MyVmhjbU5vWDNCaGRHZzljR2RmWTJGMFlXeHZaeUJCVXlBa0pBcENSVWRKVGdvZ1NVWWdWRWRmVkVGQ1RFVmZUa0ZOUlQwbllYUjBjbWxpZFhScGIyNG5JRUZPUkNCT1QxUWdSVmhKVTFSVEtBb2dJQ0JUUlV4RlExUWdSbEpQVFNCeWFGOXlaWE5sWVhKamFDNXpkSFZrZVY5aWFXNWthVzVuSUdJZ1NrOUpUaUJ3ZFdKc2FXTXVjM1IxWkhsZlpXNXliMnhzYldWdWRDQmxDaUFnSUNCUFRpQmxMaUowWlc1aGJuUkpaQ0k5WWk1MFpXNWhiblJmYVdRZ1FVNUVJR1V1SW5OMGRXUjVSM0p2ZFhCSlpDSTlZaTV6ZEhWa2VWOW5jbTkxY0Y5cFpDQkJUa1FnWlM0aWNtVnpaV0Z5WTJoUWNtOXFaV04wU1dRaVBXSXVaWGhsWTNWMGFXOXVYM0J5YjJwbFkzUmZhV1FLSUNBZ1YwaEZVa1VnWWk1MFpXNWhiblJmYVdROVRrVlhMblJsYm1GdWRGOXBaQ0JCVGtRZ1lpNXBaRDFPUlZjdWMzUjFaSGxmYVdRZ1FVNUVJR1V1YVdROVRrVlhMbVZ1Y205c2JHMWxiblJmYVdRZ1FVNUVJRTVQVkNCbExpSmhZMk5sY0hSaGJtTmxSbWw0ZEhWeVpTSUtJQ2tnVkVoRlRpQlNRVWxUUlNCRldFTkZVRlJKVDA0Z0owTkZUbFJGVWw5RlRsSlBURXhOUlU1VVgxTkRUMUJGWDBsT1ZrRk1TVVFuSUZWVFNVNUhJRVZTVWtOUFJFVTlKekl6TlRFMEp6c2dSVTVFSUVsR093b2dVa1ZVVlZKT0lFNUZWenNLUlU1RUlDUWtPd290TFNCQWMzUmhkR1Z0Wlc1MENrTlNSVUZVUlNCVVVrbEhSMFZTSUhaaGJHbGtZWFJsWDNCaGNtVnVkQ0JDUlVaUFVrVWdTVTVUUlZKVUlFOU9JSEpvWDJObGJuUmxjaTVoZEhSeWFXSjFkR2x2YmlCR1QxSWdSVUZEU0NCU1QxY2dSVmhGUTFWVVJTQkdWVTVEVkVsUFRpQnlhRjlqWlc1MFpYSXVkbUZzYVdSaGRHVmZjR0Z5Wlc1MEtDazdDaTB0SUVCemRHRjBaVzFsYm5RS1JFOGdKQ1FnUkVWRFRFRlNSU0IwWVdJZ2RHVjRkRHNnWVhCd1gzSnZiR1VnZEdWNGREc2dRa1ZIU1U0S0lFWlBVa1ZCUTBnZ2RHRmlJRWxPSUVGU1VrRlpJRUZTVWtGWld5ZGpaVzUwWlhJbkxDZHdiR0Z1Snl3bllXTmpaWE56Snl3bllYUjBjbWxpZFhScGIyNG5YU0JNVDA5UUNpQWdSVmhGUTFWVVJTQm1iM0p0WVhRb0owRk1WRVZTSUZSQlFreEZJSEpvWDJObGJuUmxjaTRsU1NCRlRrRkNURVVnVWs5WElFeEZWa1ZNSUZORlExVlNTVlJaSnl4MFlXSXBPd29nSUVWWVJVTlZWRVVnWm05eWJXRjBLQ2RCVEZSRlVpQlVRVUpNUlNCeWFGOWpaVzUwWlhJdUpVa2dSazlTUTBVZ1VrOVhJRXhGVmtWTUlGTkZRMVZTU1ZSWkp5eDBZV0lwT3dvZ0lFVllSVU5WVkVVZ1ptOXliV0YwS0NkRFVrVkJWRVVnVUU5TVNVTlpJSFJsYm1GdWRGOWliM1Z1WkdGeWVTQlBUaUJ5YUY5alpXNTBaWEl1SlVrZ1ZWTkpUa2NnS0hSbGJtRnVkRjlwWkQxamRYSnlaVzUwWDNObGRIUnBibWNvSnlkaGNIQXVkR1Z1WVc1MFgybGtKeWNzZEhKMVpTa3BJRmRKVkVnZ1EwaEZRMHNnS0hSbGJtRnVkRjlwWkQxamRYSnlaVzUwWDNObGRIUnBibWNvSnlkaGNIQXVkR1Z1WVc1MFgybGtKeWNzZEhKMVpTa3BKeXgwWVdJcE93b2dSVTVFSUV4UFQxQTdDaUJHVDFKRlFVTklJR0Z3Y0Y5eWIyeGxJRWxPSUVGU1VrRlpJRUZTVWtGWld5ZGhhWE5qYVY5aGNIQW5MQ2R5WlhObFlYSmphR2gxWWw5a1pXMXZYMkZ3Y0NkZElFeFBUMUFLSUNCSlJpQkZXRWxUVkZNZ0tGTkZURVZEVkNCR1VrOU5JSEJuWDNKdmJHVnpJRmRJUlZKRklISnZiRzVoYldVOVlYQndYM0p2YkdVcElGUklSVTRLSUNBZ1JWaEZRMVZVUlNCbWIzSnRZWFFvSjBkU1FVNVVJRlZUUVVkRklFOU9JRk5EU0VWTlFTQnlhRjlqWlc1MFpYSWdWRThnSlVrbkxHRndjRjl5YjJ4bEtUc0tJQ0FnUlZoRlExVlVSU0JtYjNKdFlYUW9KMGRTUVU1VUlGTkZURVZEVkN4SlRsTkZVbFFnVDA0Z1FVeE1JRlJCUWt4RlV5QkpUaUJUUTBoRlRVRWdjbWhmWTJWdWRHVnlJRlJQSUNWSkp5eGhjSEJmY205c1pTazdDaUFnSUVWWVJVTlZWRVVnWm05eWJXRjBLQ2RIVWtGT1ZDQlZVRVJCVkVVZ0tHNWhiV1VzWVdOMGFYWmxLU0JQVGlCeWFGOWpaVzUwWlhJdVkyVnVkR1Z5SUZSUElDVkpKeXhoY0hCZmNtOXNaU2s3Q2lBZ0lFVllSVU5WVkVVZ1ptOXliV0YwS0NkSFVrRk9WQ0JWVUVSQlZFVWdLR0ZqZEdsMlpTa2dUMDRnY21oZlkyVnVkR1Z5TG1GalkyVnpjeUJVVHlBbFNTY3NZWEJ3WDNKdmJHVXBPd29nSUNCRldFVkRWVlJGSUdadmNtMWhkQ2duUjFKQlRsUWdWVkJFUVZSRklDaGhjSEJ5YjNabFpGOWllU3hoY0hCeWIzWmxaRjloZENrZ1QwNGdjbWhmWTJWdWRHVnlMbkJzWVc0c2NtaGZZMlZ1ZEdWeUxtRjBkSEpwWW5WMGFXOXVJRlJQSUNWSkp5eGhjSEJmY205c1pTazdDaUFnUlU1RUlFbEdPd29nUlU1RUlFeFBUMUE3Q2tWT1JDQWtKRHNLJywnYmFzZTY0Jyk7CmNvbnN0IGRpZ2VzdD0nOWRiMDFjZjE2NDE1NjVmNDZmZGQyMWQ3ZmMzOWI4OTYzN2QwMzQ2MTZjZTZkMjk1ZWRkMTE2NDAzYjkxMWQ2Yic7CmNvbnN0IHJldmlzaW9uPSdyaC1jZW50ZXIudjE6JytkaWdlc3Q7CmNvbnN0IGV4cGVjdGVkVGFibGVzPVsnYWNjZXNzJywnYXR0cmlidXRpb24nLCdjZW50ZXInLCdwbGFuJ107CmxldCBwcmlzbWEsc3RhZ2U9J3Njb3BlJyxjb21taXR0ZWQ9ZmFsc2U7CnRyeXsKIGFzc2VydC5lcXVhbChjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoc3FsKS5kaWdlc3QoJ2hleCcpLGRpZ2VzdCk7CiBjb25zdCBjb25maWc9cmVhZFJlc2VhcmNoUnVudGltZUNvbmZpZyhwcm9jZXNzLmVudik7CiBjb25zdCB7ZGF0YWJhc2UsdGVuYW50SWQsbWFya2VyRGlnZXN0LGFwcFJvbGUsZGlyZWN0Um9sZX09Y29uZmlnLmlkZW50aXR5OwogYXNzZXJ0LmVxdWFsKGRhdGFiYXNlLCdyZXNlYXJjaGh1YicpOwogYXNzZXJ0LmVxdWFsKHRlbmFudElkLCdyaC1rYi1sb2NhbC1iMGUyYWY5ZC10ZW5hbnQnKTsKIGFzc2VydC5lcXVhbChtYXJrZXJEaWdlc3QsJ2NiMzg3Zjk3MDc4YzZhZjMwNDgwN2IxMzJhMDBkMjQwMGQ3ZjEwZTZkMmMzOWUwNTA2MTZlNDU1NTQyZGU1MjMnKTsKIGFzc2VydC5lcXVhbChkaXJlY3RSb2xlLCdyZXNlYXJjaGh1Yl9kZW1vX293bmVyJyk7YXNzZXJ0LmVxdWFsKGFwcFJvbGUsJ3Jlc2VhcmNoaHViX2RlbW9fYXBwJyk7CiBjb25zdCB7bG9hZH09cnVudGltZURlcGVuZGVuY2llcyhjb25maWcuY29yZSk7CiBwcmlzbWE9bmV3IChsb2FkKCdwcmlzbWEvcHJpc21hLnNlcnZpY2UnLCdQcmlzbWFTZXJ2aWNlJykpKCk7CiBjb25zdCBlbnY9YmluZFJ1bnRpbWVUcmFuc2FjdGlvbnMoe3ByaXNtYSxleHBlY3RlZDpjb25maWcuaWRlbnRpdHl9KTsKIGNvbnN0IGJhc2VsaW5lPXtmaW5nZXJwcmludDpwcm9jZXNzLmVudi5IVUJfU0NIRU1BX0ZJTkdFUlBSSU5ULHNjaGVtYXM6cHJvY2Vzcy5lbnYuSFVCX01BTkFHRURfU0NIRU1BUy5zcGxpdCgnLCcpfTsKIGFzc2VydCghYmFzZWxpbmUuc2NoZW1hcy5pbmNsdWRlcygncmhfY2VudGVyJykpOwogc3RhZ2U9J2Jhc2VsaW5lJzsKIGF3YWl0IHZlcmlmeVJ1bnRpbWVTY2hlbWEoZW52LGJhc2VsaW5lKTsKIHN0YWdlPSd0cmFuc2FjdGlvbic7CiBjb25zdCBjaGFuZ2VzPWF3YWl0IHdpdGhEZXBsb3ltZW50VHJhbnNhY3Rpb24oZW52LCdkaXJlY3QnLGFzeW5jIHR4PT57CiAgYXdhaXQgdHguJGV4ZWN1dGVSYXdVbnNhZmUoIlNFVCBMT0NBTCBsb2NrX3RpbWVvdXQ9JzNzJyIpOwogIGF3YWl0IHR4LiRxdWVyeVJhd2BTRUxFQ1QgcGdfYWR2aXNvcnlfeGFjdF9sb2NrKGhhc2h0ZXh0KCdyZXNlYXJjaGh1YjpzdHVkeS1jZW50ZXJzLXNjaGVtYScpKTo6dGV4dGA7CiAgY29uc3QgW2lkZW50aXR5XT1hd2FpdCB0eC4kcXVlcnlSYXdgU0VMRUNUIGN1cnJlbnRfdXNlciBBUyByb2xlLAogICB0b19yZWduYW1lc3BhY2UoJ3JoX2NlbnRlcicpIElTIE5VTEwgQVMgYWJzZW50LAogICBjb2FsZXNjZSgoU0VMRUNUIGhhc19kYXRhYmFzZV9wcml2aWxlZ2Uob2lkLGN1cnJlbnRfZGF0YWJhc2UoKSwnQ09OTkVDVCcpIEZST00gcGdfcm9sZXMgV0hFUkUgcm9sbmFtZT0nYWlzY2lfYXBwJyksZmFsc2UpIEFTIGxlZ2FjeV9jb25uZWN0YDsKICBhc3NlcnQuZXF1YWwoaWRlbnRpdHkucm9sZSxkaXJlY3RSb2xlKTthc3NlcnQuZXF1YWwoaWRlbnRpdHkubGVnYWN5X2Nvbm5lY3QsZmFsc2UsJ0NFTlRFUl9MRUdBQ1lfQUNDRVNTX1JFSkVDVEVEJyk7CiAgaWYoaWRlbnRpdHkuYWJzZW50KXsKICAgZm9yKGNvbnN0IHN0YXRlbWVudCBvZiBzcWwudG9TdHJpbmcoJ3V0ZjgnKS5zcGxpdCgvXi0tIEBzdGF0ZW1lbnRccyokL20pLnNsaWNlKDEpLm1hcChzPT5zLnRyaW0oKSkpYXdhaXQgdHguJGV4ZWN1dGVSYXdVbnNhZmUoc3RhdGVtZW50KTsKICAgYXdhaXQgdHguJGV4ZWN1dGVSYXdVbnNhZmUoYENPTU1FTlQgT04gU0NIRU1BIHJoX2NlbnRlciBJUyAnJHtyZXZpc2lvbn0nYCk7CiAgfQogIGNvbnN0IFtzY2hlbWFdPWF3YWl0IHR4LiRxdWVyeVJhd2BTRUxFQ1Qgb2JqX2Rlc2NyaXB0aW9uKG9pZCwncGdfbmFtZXNwYWNlJykgQVMgcmV2aXNpb24gRlJPTSBwZ19uYW1lc3BhY2UgV0hFUkUgbnNwbmFtZT0ncmhfY2VudGVyJ2A7CiAgYXNzZXJ0LmVxdWFsKHNjaGVtYS5yZXZpc2lvbixyZXZpc2lvbik7CiAgY29uc3QgdGFibGVzPWF3YWl0IHR4LiRxdWVyeVJhd2BTRUxFQ1QgcmVsbmFtZSBBUyBuYW1lLHJlbHJvd3NlY3VyaXR5IEFTIHJscyxyZWxmb3JjZXJvd3NlY3VyaXR5IEFTIGZvcmNlZAogICBGUk9NIHBnX2NsYXNzIFdIRVJFIHJlbG5hbWVzcGFjZT0ncmhfY2VudGVyJzo6cmVnbmFtZXNwYWNlIEFORCByZWxraW5kPSdyJyBPUkRFUiBCWSByZWxuYW1lYDsKICBhc3NlcnQuZGVlcEVxdWFsKHRhYmxlcy5tYXAodGFibGU9PnRhYmxlLm5hbWUpLGV4cGVjdGVkVGFibGVzKTsKICBhc3NlcnQodGFibGVzLmV2ZXJ5KHRhYmxlPT50YWJsZS5ybHMmJnRhYmxlLmZvcmNlZCkpOwogIGNvbnN0IFthY2xdPWF3YWl0IHR4LiRxdWVyeVJhd2BTRUxFQ1QgaGFzX3NjaGVtYV9wcml2aWxlZ2UoJHthcHBSb2xlfSwncmhfY2VudGVyJywnVVNBR0UnKSBBUyBhcHBfdXNhZ2UsCiAgIGhhc19zY2hlbWFfcHJpdmlsZWdlKCR7YXBwUm9sZX0sJ3JoX2NlbnRlcicsJ0NSRUFURScpIEFTIGFwcF9jcmVhdGUsCiAgIGhhc190YWJsZV9wcml2aWxlZ2UoJHthcHBSb2xlfSwncmhfY2VudGVyLmF0dHJpYnV0aW9uJywnU0VMRUNUJykgQVMgYXBwX3JlYWQsCiAgIGhhc190YWJsZV9wcml2aWxlZ2UoJHthcHBSb2xlfSwncmhfY2VudGVyLmF0dHJpYnV0aW9uJywnSU5TRVJUJykgQVMgYXBwX2luc2VydCwKICAgaGFzX3RhYmxlX3ByaXZpbGVnZSgke2FwcFJvbGV9LCdyaF9jZW50ZXIuYXR0cmlidXRpb24nLCdERUxFVEUnKSBBUyBhcHBfZGVsZXRlYDsKICBhc3NlcnQuZGVlcEVxdWFsKGFjbCx7YXBwX3VzYWdlOnRydWUsYXBwX2NyZWF0ZTpmYWxzZSxhcHBfcmVhZDp0cnVlLGFwcF9pbnNlcnQ6dHJ1ZSxhcHBfZGVsZXRlOmZhbHNlfSk7CiAgcmV0dXJuIHt0YWJsZXMsYWNsLHJldXNlZDohaWRlbnRpdHkuYWJzZW50fTsKIH0pOwogY29tbWl0dGVkPXRydWU7CiBzdGFnZT0nYXBwbGljYXRpb24nOwogY29uc3QgYXBwUm93cz1hd2FpdCB3aXRoRGVwbG95bWVudFRyYW5zYWN0aW9uKGVudiwnYXBwJyxhc3luYyB0eD0+ewogIGNvbnN0IFtyb3ddPWF3YWl0IHR4LiRxdWVyeVJhd2BTRUxFQ1QgY291bnQoKik6OmludCBBUyBjb3VudCBGUk9NIHJoX2NlbnRlci5jZW50ZXJgOwogIHJldHVybiByb3cuY291bnQ7CiB9LHtyZWFkT25seTp0cnVlfSk7CiBhc3NlcnQuZXF1YWwoYXBwUm93cywwKTsKIGF3YWl0IHZlcmlmeVJ1bnRpbWVTY2hlbWEoZW52LGJhc2VsaW5lKTsKIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KHtzdGF0dXM6J2h1Yi1jZW50ZXItbWlncmF0ZWQnLGRhdGFiYXNlLGRpZ2VzdCxyZXZpc2lvbixhcHBSb3dzLC4uLmNoYW5nZXMscHJldmlvdXNTY2hlbWFWZXJpZmllZDp0cnVlfSkpOwp9Y2F0Y2goZXJyb3IpewogY29uc3QgY29kZT1lcnJvci5jb2RlPz9lcnJvci5tZXNzYWdlOwogY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkoe3N0YXR1czonc3RvcHBlZCcsc3RhZ2UsY29tbWl0dGVkLGNvZGU6L15bQS1aXVtBLVpfMC05XXsyLDc1fSQvLnRlc3QoY29kZSk/Y29kZTonSFVCX0NFTlRFUl9NSUdSQVRJT05fRkFJTEVEJyxkYXRhYmFzZUNvZGU6dHlwZW9mIGVycm9yLm1ldGE/LmNvZGU9PT0nc3RyaW5nJyYmL15bMC05QS1aXXs1fSQvLnRlc3QoZXJyb3IubWV0YS5jb2RlKT9lcnJvci5tZXRhLmNvZGU6dW5kZWZpbmVkfSkpOwogcHJvY2Vzcy5leGl0Q29kZT0xOwp9ZmluYWxseXsKIGF3YWl0IHByaXNtYT8uYXBwPy4kZGlzY29ubmVjdCgpOwogYXdhaXQgcHJpc21hPy5lbGV2YXRlZD8uJGRpc2Nvbm5lY3QoKTsKfQo=')
stage='preflight'

def require(value,code):
    if not value:
        raise ValueError(code)

def invoke(args, stdin=None, timeout=30, env=None, stdout=subprocess.PIPE):
    result=subprocess.run(args,input=stdin,stdout=stdout,stderr=subprocess.PIPE,timeout=timeout,env=env)
    if result.returncode:
        raise ValueError(stage.upper()+'_FAILED')
    return result.stdout

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(4*1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()

def verify_rollback():
    p=json.loads((OPS/'paired-current.json').read_text())
    require(p['tag']==TAG and p['manifestSha256']==MANIFEST,'HUB_ROLLBACK_BASELINE_CHANGED')
    base=OPS/'runtime-releases'/TAG
    good=[x for x in base.glob('control-*/runtime-release.json') if not x.is_symlink() and sha(x)==MANIFEST]
    require(good,'HUB_ROLLBACK_MANIFEST_MISSING')
    m=json.loads(good[0].read_text())
    for name in ('backend-image.tar.gz','researchhub.tar.gz'):
        require(any(not x.is_symlink() and sha(x)==m['files'][name]['sha256'] for x in base.glob('control-*/'+name)),'HUB_ROLLBACK_ARCHIVE_INVALID')

def pg_connection(container):
    raw=invoke(['docker','exec',container,'node','--input-type=module','-e',
     """import{readResearchRuntimeConfig}from'./server/research-runtime/config.mjs';
const c=readResearchRuntimeConfig(process.env);if(c.identity.database!=='researchhub'||c.identity.directRole!=='researchhub_demo_owner'||c.identity.markerDigest!=='cb387f97078c6af304807b132a00d2400d7f10e6d2c39e050616e455542de523')process.exit(2);process.stdout.write(process.env.DIRECT_URL)"""])
    url=urllib.parse.urlsplit(raw.decode())
    require(url.path=='/researchhub' and url.username=='researchhub_demo_owner' and bool(url.hostname) and bool(url.password),'HUB_BACKUP_TARGET_REJECTED')
    ssl=urllib.parse.parse_qs(url.query).get('sslmode',['prefer'])[0]
    require(ssl in ('disable','allow','prefer','require','verify-ca','verify-full'),'HUB_BACKUP_SSL_REJECTED')
    return dict(os.environ,PGHOST=url.hostname,PGPORT=str(url.port or 5432),PGUSER='researchhub_demo_owner',
       PGDATABASE='researchhub',PGPASSWORD=urllib.parse.unquote(url.password),PGSSLMODE=ssl,PGCONNECT_TIMEOUT='15',PGOPTIONS='-c default_transaction_read_only=on')

def backup(container):
    global stage
    stage='backup_image'
    require(shutil.disk_usage(str(OPS)).free>8*1024**3,'HUB_BACKUP_FREE_SPACE_REQUIRED')
    require(re.fullmatch(r'sha256:[0-9a-f]{64}',IMAGE),'HUB_BACKUP_IMAGE_ID_REJECTED')
    available=subprocess.run(['docker','image','inspect',IMAGE],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
    if not available:
        with tempfile.TemporaryDirectory(prefix='.center-pg18-image-',dir=str(OPS)) as cache:
            archive=pathlib.Path(cache)/'postgres.tar.gz'
            invoke(['curl','-fsS','--retry','2','--connect-timeout','12','--max-time','300','-o',str(archive),'--config','-'],
                   stdin=('url = '+json.dumps(IMAGE_URL)+'\n').encode(),timeout=320)
            require(sha(archive)==IMAGE_SHA,'HUB_BACKUP_IMAGE_HASH_MISMATCH')
            invoke(['docker','load','--input',str(archive)],timeout=120)
    ref=json.loads(invoke(['docker','image','inspect',IMAGE]))
    require(len(ref)==1 and ref[0]['Id']==IMAGE and ref[0]['Architecture']=='amd64','HUB_BACKUP_IMAGE_PLATFORM_REJECTED')
    stage='backup_copy'
    base=['docker','run','--rm','--pull','never','--label','researchhub.operation=center-backup','--read-only','--user','65534:65534']
    env=pg_connection(container)
    args=base+['--network','host']
    for key in ['PGHOST','PGPORT','PGUSER','PGDATABASE','PGPASSWORD','PGSSLMODE','PGCONNECT_TIMEOUT','PGOPTIONS']:
        args+=['--env',key]
    os.umask(0o077)
    directory=OPS/'database-backups'
    require(not directory.is_symlink(),'HUB_BACKUP_DESTINATION_REJECTED')
    directory.mkdir(mode=0o700,exist_ok=True)
    require(directory.stat().st_uid==0 and directory.stat().st_mode&0o077==0,'HUB_BACKUP_DESTINATION_PERMISSIONS')
    with tempfile.NamedTemporaryFile(dir=str(directory),prefix='researchhub-before-center-',suffix='.dump.part',delete=False) as file:
        temporary=pathlib.Path(file.name)
        try:
            invoke(args+['--entrypoint','pg_dump',IMAGE,'--format=custom','--no-password','--lock-wait-timeout=5s'],
                   env=env,stdout=file,timeout=360)
            file.flush()
            os.fsync(file.fileno())
        except BaseException:
            temporary.unlink()
            raise
    stage='backup_validate'
    try:
        with temporary.open('rb') as f:
            check=subprocess.run(base+['-i','--network','none','--entrypoint','pg_restore',IMAGE,'--list'],stdin=f,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
        require(check.returncode==0 and b'rh_research study_binding' in check.stdout
             and b'public study_enrollment' in check.stdout and b'public enrollment_target' in check.stdout
             and b'TABLE DATA' in check.stdout,'HUB_BACKUP_CONTENT_REJECTED')
        with temporary.open('rb') as f:
            check=subprocess.run(base+['-i','--network','none','--entrypoint','pg_restore',IMAGE,'--file=/dev/null'],
                                 stdin=f,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=120)
        require(check.returncode==0,'HUB_BACKUP_PAYLOAD_REJECTED')
        final=temporary.with_suffix('')
        os.replace(str(temporary),str(final))
        return {'file':final.name,'bytes':final.stat().st_size,'sha256':sha(final),'tocVerified':True,'payloadDecoded':True,'database':'researchhub'}
    finally:
        if temporary.exists():
            temporary.unlink()

def main():
    global stage
    verify_rollback()
    ids=invoke(['docker','ps','-q','--filter','label=com.docker.compose.project=researchhub-backend','--filter','label=com.docker.compose.service=researchhub-api']).decode().split()
    require(len(ids)==1 and re.fullmatch(r'[0-9a-f]{12,64}',ids[0]),'HUB_API_CONTAINER_REJECTED')
    rec=backup(ids[0])
    print(json.dumps({'status':'hub-center-backup-verified','rollbackTag':TAG,'rollbackManifestSha256':MANIFEST,'backup':rec}),flush=True)
    stage='migration'
    verify_rollback()
    result=subprocess.run(['docker','exec','-i',ids[0],'node','--input-type=module','-'],
                          input=NODE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=80)
    lines=result.stdout.decode().splitlines()
    value=json.loads(lines[-1]) if lines else {'status':'stopped','code':'HUB_CENTER_NO_MIGRATION_RECEIPT'}
    print(json.dumps(value),flush=True)
    return result.returncode

if __name__=='__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        code=str(error) if re.fullmatch(r'[A-Z0-9_]{3,90}',str(error)) else 'HUB_CENTER_OPERATION_FAILED'
        print(json.dumps({'status':'stopped','stage':stage,'code':code}),flush=True)
        raise SystemExit(1)
