class AbsoluteMediaURLMixin:
    """
    Helper mixin for returning absolute media URLs in serializers.
    """

    def build_absolute_media_url(self, file_field):
        if not file_field:
            return None
        
        try:
            url = file_field.url
        except ValueError:
            return None
        
        request = self.context.get("request") if hasattr(self, "context") else None


        if request is None:
            return url
        
        return request.build_absolute_url(url)