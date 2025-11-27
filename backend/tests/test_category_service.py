import unittest
from unittest.mock import MagicMock, patch
# Adjust import path if running from root, but for relative imports in package...
# We will assume running with `python -m unittest backend/tests/test_category_service.py` or similar
# Imports need to be correct relative to python path.
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.category import list_categories
from app.schemas.category import CategoryType

class TestCategoryService(unittest.TestCase):
    
    @patch('app.services.category.get_db')
    def test_list_categories_hierarchy(self, mock_get_db):
        """
        Test that list_categories correctly assembles a parent-child hierarchy
        from a flat list of documents.
        """
        # Mock DB Setup
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        
        # Setup the chain of .collection().where().where().stream()
        # Note: In the code: db.collection().where(user).where(type).stream()
        
        mock_col = mock_db.collection.return_value
        mock_query_user = mock_col.where.return_value
        mock_query_type = mock_query_user.where.return_value
        
        # Mock Docs
        # Root 1
        doc1 = MagicMock()
        doc1.id = "root1"
        doc1.to_dict.return_value = {
            "name": "House", 
            "user_id": "user1", 
            "type": "expense", 
            "parent_id": None,
            "icon": "pi pi-home",
            "color": "#000",
            "is_custom": True
        }
        
        # Child 1 of Root 1
        doc2 = MagicMock()
        doc2.id = "child1"
        doc2.to_dict.return_value = {
            "name": "Rent", 
            "user_id": "user1", 
            "type": "expense", 
            "parent_id": "root1",
            "icon": "pi pi-key",
            "color": "#000",
            "is_custom": True
        }
        
        # Return these docs when stream is called
        mock_query_type.stream.return_value = [doc1, doc2]
        
        # Call function
        # Note: The service code handles building the tree
        result = list_categories("user1", CategoryType.EXPENSE)
        
        # Assertions
        self.assertEqual(len(result), 1, "Should return 1 root category")
        root = result[0]
        self.assertEqual(root.id, "root1")
        self.assertEqual(root.name, "House")
        
        # Check Subcategories
        self.assertEqual(len(root.subcategories), 1, "Root should have 1 subcategory")
        child = root.subcategories[0]
        self.assertEqual(child.id, "child1")
        self.assertEqual(child.name, "Rent")
        self.assertEqual(child.parent_id, "root1")

if __name__ == '__main__':
    unittest.main()
