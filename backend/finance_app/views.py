from django.http import JsonResponse


def csrf_failure(request, reason=""):
    origin = request.META.get("HTTP_ORIGIN")
    referer = request.META.get("HTTP_REFERER")
    host = request.META.get("HTTP_HOST")
    path = request.META.get("PATH_INFO")

    print(
        "[CSRF] Failed",
        {
            "reason": reason,
            "origin": origin,
            "referer": referer,
            "host": host,
            "path": path,
        },
    )

    return JsonResponse({"error": "CSRF Failed", "reason": reason}, status=403)
