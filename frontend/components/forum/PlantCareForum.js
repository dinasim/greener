```javascript
import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';

const ForumTopicsScreen = ({ navigation, route }) => {
  const { topics } = route.params;

  return (
    <View>
      <FlatList
        data={topics}
        keyExtractor={(item) => item.id}
        renderItem={({ item: topic }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('ForumTopicDetail', { topicId: topic.id })}
          >
            <View>
              <Text>{topic.title}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default ForumTopicsScreen;
```